import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configurePlatform,
  createEmptyContentBundle,
  createMemoryPlatform,
  platform,
  resetPlatform,
} from '../src/ports';
import {
  clearMemoryCache,
  fetchCachedText,
  getCached,
  getStale,
  setCached,
} from '../src/services/cache.service';
import {
  registerExclusiveMedium,
  resetExclusiveMedia,
  stopOtherMedia,
} from '../src/media/exclusive-playback';

beforeEach(() => {
  resetPlatform();
  clearMemoryCache();
  resetExclusiveMedia();
});

describe('platform ports', () => {
  it('works unconfigured, so tests and headless tooling need no setup', async () => {
    expect(await platform().keyValue.getString('nothing')).toBeNull();
    expect(await platform().blobs.read('ns', 'nothing')).toBeNull();
    expect(platform().content.article('https://correctiv.org/x/')).toBeNull();
  });

  it('has no audio backend until a host registers one', () => {
    expect(platform().audio).toBeUndefined();
  });

  it('lets a host take over storage', async () => {
    const host = createMemoryPlatform();
    configurePlatform(host);
    await platform().keyValue.setString('k', 'v');
    expect(await host.keyValue.getString('k')).toBe('v');
  });

  it('round-trips and removes key/value entries', async () => {
    const kv = platform().keyValue;
    await kv.setString('store.settings', '{"theme":"dark"}');
    expect(await kv.getString('store.settings')).toBe('{"theme":"dark"}');
    await kv.remove('store.settings');
    expect(await kv.getString('store.settings')).toBeNull();
  });

  it('answers every ContentBundle question with null when the host bundles nothing', () => {
    const empty = createEmptyContentBundle();
    expect(empty.feed('recherchen')).toBeNull();
    expect(empty.article('https://correctiv.org/x/')).toBeNull();
    expect(empty.image('https://correctiv.org/x/')).toBeNull();
    expect(empty.podcastSeries('klima')).toBeNull();
  });
});

describe('cache.service', () => {
  it('returns a fresh entry within its TTL', async () => {
    await setCached('feeds', 'recherchen', [{ id: '1' }]);
    expect(await getCached('feeds', 'recherchen', 60_000)).toEqual([{ id: '1' }]);
  });

  it('treats an entry older than its TTL as a miss', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-01T10:00:00Z'));
      await setCached('feeds', 'recherchen', ['old']);
      vi.setSystemTime(new Date('2026-08-01T10:05:00Z'));
      expect(await getCached('feeds', 'recherchen', 60_000)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still serves an expired entry as stale — the offline fallback', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-01T10:00:00Z'));
      await setCached('feeds', 'recherchen', ['old']);
      vi.setSystemTime(new Date('2026-08-01T11:00:00Z'));
      clearMemoryCache(); // force it through the BlobStore port, not the session map
      expect(await getCached('feeds', 'recherchen', 60_000)).toBeNull();
      expect(await getStale('feeds', 'recherchen')).toEqual(['old']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps namespaces apart', async () => {
    await setCached('feeds', 'x', 'a');
    await setCached('podcasts', 'x', 'b');
    expect(await getCached('feeds', 'x', 60_000)).toBe('a');
    expect(await getCached('podcasts', 'x', 60_000)).toBe('b');
  });

  it('survives a BlobStore that throws — the blob cache is best-effort', async () => {
    const memory = createMemoryPlatform();
    configurePlatform({
      ...memory,
      blobs: {
        read: () => Promise.reject(new Error('disk gone')),
        write: () => Promise.reject(new Error('disk full')),
        delete: () => Promise.reject(new Error('disk gone')),
      },
    });
    await expect(setCached('feeds', 'x', 'a')).resolves.toBeUndefined();
    expect(await getCached('feeds', 'x', 60_000)).toBe('a'); // session layer still answers
    clearMemoryCache();
    expect(await getStale('feeds', 'x')).toBeNull();
  });

  it('ignores corrupt persisted payloads instead of throwing', async () => {
    const memory = createMemoryPlatform();
    configurePlatform(memory);
    await setCached('feeds', 'x', 'a');
    clearMemoryCache();
    // overwrite the stored blob with garbage, whatever its hashed name is
    const spy = vi.spyOn(memory.blobs, 'read').mockResolvedValue('{ not json');
    expect(await getStale('feeds', 'x')).toBeNull();
    spy.mockRestore();
  });
});

/**
 * The two policies are the reason this cache exists in the core at all. One host
 * had them and the other did not, so the same offline situation produced different
 * screens.
 */
describe('fetchCachedText policies', () => {
  const OK = 'body';

  function stubFetch(impl: () => Promise<string>) {
    return vi.stubGlobal('fetch', () =>
      impl().then((text) => ({ ok: true, status: 200, text: () => Promise.resolve(text) })),
    );
  }

  it('network-first prefers the network and caches what it gets', async () => {
    stubFetch(() => Promise.resolve(OK));
    expect(await fetchCachedText('k', 'https://x/')).toBe(OK);

    stubFetch(() => Promise.reject(new Error('offline')));
    expect(await fetchCachedText('k', 'https://x/')).toBe(OK); // from the cache
    vi.unstubAllGlobals();
  });

  it('cache-first skips the network entirely while the entry is fresh', async () => {
    const spy = vi.fn(() => Promise.resolve(OK));
    stubFetch(spy);
    await fetchCachedText('page', 'https://x/', { policy: 'cache-first' });
    await fetchCachedText('page', 'https://x/', { policy: 'cache-first' });
    expect(spy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('throws only when neither the network nor the cache can answer', async () => {
    stubFetch(() => Promise.reject(new Error('offline')));
    await expect(fetchCachedText('cold', 'https://x/')).rejects.toThrow('offline');
    vi.unstubAllGlobals();
  });
});

describe('exclusive playback', () => {
  it('stops every other medium but not the one starting', () => {
    const audio = vi.fn();
    const video = vi.fn();
    registerExclusiveMedium('audio', audio);
    registerExclusiveMedium('video', video);

    stopOtherMedia('video');
    expect(audio).toHaveBeenCalledTimes(1);
    expect(video).not.toHaveBeenCalled();

    stopOtherMedia('audio');
    expect(video).toHaveBeenCalledTimes(1);
    expect(audio).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when nothing is registered', () => {
    expect(() => stopOtherMedia('audio')).not.toThrow();
  });

  it('does not let one failing medium block the others', () => {
    const boom = vi.fn(() => {
      throw new Error('player detached');
    });
    const other = vi.fn();
    registerExclusiveMedium('boom', boom);
    registerExclusiveMedium('other', other);

    expect(() => stopOtherMedia('starter')).not.toThrow();
    expect(other).toHaveBeenCalledTimes(1);
  });
});
