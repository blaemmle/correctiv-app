import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configurePlatform, createMemoryPlatform, type CorePlatform } from '../src/ports';
import {
  CACHE_LIMITS,
  clearMemoryCache,
  fileKey,
  getCached,
  getStale,
  setCached,
} from '../src/services/cache.service';

/**
 * The cache's ceiling, which is the half of this cache that can go wrong quietly.
 *
 * A TTL only says when an entry stops being fresh; it never said when one stops
 * existing, so before this the cache grew for as long as the app ran and kept
 * growing across restarts. Under MMKV that store is mapped into the process, so
 * these limits are a memory bound and not a disk one — ADR 0026 §4 measured 4 MiB
 * of cache as 4.55 MiB of settled PSS.
 *
 * Every test here writes through the real `setCached` against a memory host and
 * then asks the HOST what is left, not the session map: an eviction that forgets
 * the entry in memory and leaves the blob behind is the failure that matters, and
 * it is invisible from the core's own map.
 */

/**
 * Sized so that ten of these sit inside the budget and the eleventh pushes it
 * over — a tenth exactly would not, because each entry also carries its
 * `{"data":…,"ts":…}` envelope.
 */
const BIG = Math.floor(CACHE_LIMITS.maxTotalBytes / 10.4);
const START = new Date('2026-09-14T09:00:00Z').getTime();

let host: CorePlatform;
let clock = START;

/** One write, at its own instant, so the least-recently-used order is unambiguous. */
async function writeAt(ns: string, key: string, data: unknown): Promise<void> {
  clock += 1000;
  vi.setSystemTime(clock);
  await setCached(ns, key, data);
}

/** What the HOST holds under that key, which is what an eviction has to remove. */
function persisted(ns: string, key: string): Promise<string | null> {
  return host.blobs.read(ns, `${fileKey(key)}.json`);
}

const body = (bytes: number) => 'x'.repeat(bytes);

beforeEach(() => {
  host = createMemoryPlatform();
  configurePlatform(host);
  clearMemoryCache();
  clock = START;
  vi.useFakeTimers();
  vi.setSystemTime(clock);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('maximum entry size', () => {
  it('refuses an entry larger than the cap, in both layers', async () => {
    await writeAt('http', 'huge', body(CACHE_LIMITS.maxEntryBytes + 1));

    expect(await getStale('http', 'huge')).toBeNull();
    expect(await persisted('http', 'huge')).toBeNull();
  });

  it('accepts one that just fits', async () => {
    // The payload is `{"data":"…","ts":…}`, so leave room for the envelope.
    const text = body(CACHE_LIMITS.maxEntryBytes - 64);
    await writeAt('http', 'large', text);

    expect(await getStale('http', 'large')).toBe(text);
    expect(await persisted('http', 'large')).not.toBeNull();
  });

  it('leaves the older answer under that key in place', async () => {
    // Refusing to store the new one is not a reason to throw the old one away:
    // an older cached answer is what this cache is for, and its TTL still governs.
    await writeAt('http', 'page', 'the older answer');
    await writeAt('http', 'page', body(CACHE_LIMITS.maxEntryBytes + 1));

    expect(await getStale('http', 'page')).toBe('the older answer');
  });
});

describe('the byte budget', () => {
  it('evicts until the total is back under the budget', async () => {
    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    // Eleven of these are 10 % over; the oldest goes and the rest stay.
    expect(await persisted('http', 'page-0')).toBeNull();
    expect(await persisted('http', 'page-1')).not.toBeNull();
    expect(await persisted('http', 'page-10')).not.toBeNull();
  });

  it('evicts from the session map as well as the store', async () => {
    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    // Without this the entry is gone from disk and still resident, which is the
    // exact leak the bound exists to prevent.
    expect(await getStale('http', 'page-0')).toBeNull();
  });

  it('asks the persisted store to delete, by name', async () => {
    const remove = vi.spyOn(host.blobs, 'delete');

    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    expect(remove).toHaveBeenCalledWith('http', `${fileKey('page-0')}.json`);
  });

  it('never evicts the entry the current write just stored', async () => {
    // One entry can be most of the budget on its own. Evicting the newest would
    // make a large write a no-op that also emptied the cache.
    for (let i = 0; i < 12; i++) await writeAt('http', `page-${i}`, body(BIG));

    expect(await getStale('http', 'page-11')).toBe(body(BIG));
  });
});

describe('the entry count', () => {
  it('evicts the oldest once there are more entries than the limit', async () => {
    const over = CACHE_LIMITS.maxEntries + 2;
    for (let i = 0; i < over; i++) await writeAt('feeds', `k-${i}`, i);

    // Tiny entries never reach the byte budget, which is why the count exists.
    expect(await persisted('feeds', 'k-0')).toBeNull();
    expect(await persisted('feeds', 'k-1')).toBeNull();
    expect(await persisted('feeds', 'k-2')).not.toBeNull();
    expect(await persisted('feeds', `k-${over - 1}`)).not.toBeNull();
  });
});

describe('least-recently-used order', () => {
  it('spares the entry that was read most recently', async () => {
    for (let i = 0; i < 10; i++) await writeAt('http', `page-${i}`, body(BIG));

    clock += 1000;
    vi.setSystemTime(clock);
    expect(await getCached('http', 'page-0', 60 * 60 * 1000)).toBe(body(BIG));

    await writeAt('http', 'page-10', body(BIG));

    // page-0 was written first and read last, so page-1 is now the oldest use.
    expect(await persisted('http', 'page-0')).not.toBeNull();
    expect(await persisted('http', 'page-1')).toBeNull();
  });

  it('counts a stale read too — an offline fallback is still a use', async () => {
    for (let i = 0; i < 10; i++) await writeAt('http', `page-${i}`, body(BIG));

    clock += 1000;
    vi.setSystemTime(clock);
    await getStale('http', 'page-0');

    await writeAt('http', 'page-10', body(BIG));

    expect(await persisted('http', 'page-0')).not.toBeNull();
    expect(await persisted('http', 'page-1')).toBeNull();
  });
});

describe('the bound survives a restart', () => {
  it('evicts entries this session never wrote or read', async () => {
    for (let i = 0; i < 10; i++) await writeAt('http', `page-${i}`, body(BIG));

    // A new process: the session map is empty, the host's store is not. A policy
    // that could only see the session map would let the store grow for ever, one
    // launch at a time — which with MMKV is resident memory, not idle disk.
    clearMemoryCache();

    await writeAt('http', 'page-10', body(BIG));

    expect(await persisted('http', 'page-0')).toBeNull();
    expect(await persisted('http', 'page-1')).not.toBeNull();
  });

  it('adopts a blob nobody recorded, so a seeded fixture is evictable too', async () => {
    // The workbench writes feed blobs straight into storage, and a lost ledger
    // leaves the same shape behind. Reading one is what puts it back on the books.
    const seeded = JSON.stringify({ data: ['seeded'], ts: START });
    await host.blobs.write('feeds', `${fileKey('recherchen')}.json`, seeded);

    expect(await getStale('feeds', 'recherchen')).toEqual(['seeded']);

    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    expect(await persisted('feeds', 'recherchen')).toBeNull();
  });
});

describe('what eviction cannot reach', () => {
  it('never touches the key/value store, whatever it evicts', async () => {
    // Bookmarks, settings and the session live there. The cache module imports no
    // name from that port, and this is the test that says so out loud: if eviction
    // ever grows a second destination, it fails here rather than on a device.
    const removed = vi.spyOn(host.keyValue, 'remove');
    const written = vi.spyOn(host.keyValue, 'setString');

    for (let i = 0; i < CACHE_LIMITS.maxEntries + 20; i++) {
      await writeAt('articles', `https://correctiv.org/a/${i}/`, { body: body(2000) });
    }

    expect(removed).not.toHaveBeenCalled();
    expect(written).not.toHaveBeenCalled();
  });

  it('deletes only inside the namespace it was given', async () => {
    const remove = vi.spyOn(host.blobs, 'delete');

    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    for (const call of remove.mock.calls) expect(call[0]).toBe('http');
  });
});
