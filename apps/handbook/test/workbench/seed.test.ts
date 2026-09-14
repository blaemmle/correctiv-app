import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';

import { CONTENT_FEEDS } from '@correctiv/app-core/data/feeds.config';
import { fileKey } from '@correctiv/app-core/services/cache.service';
import { PERSISTED_KEYS as SESSION_KEYS } from '@correctiv/app-core/stores/session';
import { PERSISTED_KEYS as SETTINGS_KEYS } from '@correctiv/app-core/stores/settings';

import {
  applyFixture,
  FIXTURES,
  holdTheDoorOpen,
  SEEDED_KEY,
} from '../../src/workbench/frame/seed';

/** Every source file under a directory, so a new one is checked without being listed. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * The shell writes the app's storage directly, so it has to know four things the
 * app owns: the two MMKV store ids, how a slice's key is spelled, how a cache blob
 * is named, and which feeds carry content. `seed.ts` re-implements all four,
 * deliberately — it must not import the React Native project, and it wants no
 * runtime dependency on the core either.
 *
 * The failure that costs is silent in exactly the way ADR 0014 warns about for
 * cross-origin. Change a prefix or the hash and every fixture still "succeeds":
 * `applyFixture` writes keys nothing reads, the app boots from its defaults, the
 * frame sits at the door, and `preview.html#/?s=signed-in` — the address README
 * hands out — looks like a broken app rather than a stale fixture.
 *
 * So this file holds the copies against the originals. The core is a test-only
 * dependency of the shell for this reason and no other; nothing under `src/`
 * imports it, and the Vite bundle is unchanged. The two facts that live in the
 * app rather than the core are read as source text, the way
 * `apps/mobile/__tests__/web-target.test.ts` does, because the shell may not
 * import from `apps/mobile` at all.
 */
// Resolved rather than counted: this file moved one directory deeper when the
// shell became part of the handbook, and a hard-coded depth is exactly what
// breaks silently when that happens.
const REPO = ROOT;

function source(path: string): string {
  return readFileSync(resolve(REPO, path), 'utf8');
}

/** `Object.keys()` over it must list the stored keys, as it does over the real one. */
class FakeStorage {
  getItem(key: string): string | null {
    return Object.hasOwn(this, key) ? (this as unknown as Record<string, string>)[key] : null;
  }
  setItem(key: string, value: string): void {
    (this as unknown as Record<string, string>)[key] = String(value);
  }
  removeItem(key: string): void {
    delete (this as unknown as Record<string, string>)[key];
  }
  clear(): void {
    for (const key of Object.keys(this)) this.removeItem(key);
  }
  key(index: number): string | null {
    return Object.keys(this)[index] ?? null;
  }
  get length(): number {
    return Object.keys(this).length;
  }
}

function seeded(id: string): { store: Storage; keys: string[] } {
  const store = new FakeStorage() as unknown as Storage;
  applyFixture(store, id);
  return { store, keys: Object.keys(store) };
}

/** The two prefixes MMKV's web build gives each instance, `<id>` plus a backslash. */
const STATE_PREFIX = 'correctiv.state\\';
const CACHE_PREFIX = 'correctiv.cache\\';

function payload(store: Storage, slice: string): Record<string, unknown> {
  const raw = store.getItem(`${STATE_PREFIX}store.${slice}`);
  if (raw === null) throw new Error(`no payload for ${slice}`);
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('the storage layout the shell copies', () => {
  it('writes into the two stores the app opens, and nowhere else', () => {
    // `lib/platform/expo.ts` is the only place the two ids are declared, and MMKV's
    // web build turns an id into a `localStorage` key prefix of `<id>\\`. Two
    // stores rather than one prefix is the app's own guarantee that its cache can
    // never evict a bookmark, and a fixture that wrote into the wrong one would be
    // seeding a bookmark into an evictable cache.
    const adapter = source('apps/mobile/src/lib/platform/expo.ts');
    expect(adapter).toContain("const STATE_ID = 'correctiv.state'");
    expect(adapter).toContain("const CACHE_ID = 'correctiv.cache'");

    for (const fixture of FIXTURES) {
      for (const key of seeded(fixture.id).keys) {
        expect(key.startsWith(STATE_PREFIX) || key.startsWith(CACHE_PREFIX)).toBe(true);
      }
    }
  });

  it('spells a slice key the way persist() does', () => {
    expect(source('packages/app-core/src/stores/persist.ts')).toContain(
      'const storageKey = `store.${slice.id}`',
    );
    expect(seeded('onboarded').keys.filter((k) => k.startsWith(STATE_PREFIX))).toEqual([
      `${STATE_PREFIX}store.session`,
      `${STATE_PREFIX}store.settings`,
    ]);
  });

  it('names a cache blob the way the cache service does', () => {
    // The hash is djb2, re-implemented in seed.ts. If the two ever disagree the
    // bundle fixture writes six blobs the feed cascade will never look for.
    const blobs = seeded('bundle').keys.filter((k) => k.startsWith(CACHE_PREFIX));

    expect(blobs).toEqual(CONTENT_FEEDS.map((key) => `${CACHE_PREFIX}feeds/${fileKey(key)}.json`));
  });

  it('carries exactly the keys each slice declares as persisted', () => {
    // `persist()` restores only declared keys and writes back only declared keys,
    // so an invented one is dropped on the app's first write and a missing one
    // leaves that field at its default — neither says anything on the way past.
    const { store } = seeded('onboarded');

    expect(Object.keys(payload(store, 'session')).sort()).toEqual([...SESSION_KEYS].sort());
    expect(Object.keys(payload(store, 'settings')).sort()).toEqual([...SETTINGS_KEYS].sort());
  });

  it('wipes every key any fixture can write before writing the next', () => {
    // `clearApp` matches on the same two store prefixes. A fixture that wrote
    // outside them would survive the wipe and leak into the next one silently.
    const store = new FakeStorage() as unknown as Storage;
    for (const fixture of FIXTURES) fixture.write(store);
    const everything = Object.keys(store);
    expect(everything.length).toBeGreaterThan(0);

    applyFixture(store, 'fresh');

    expect(Object.keys(store)).toEqual([]);
  });
});

/**
 * The frame on `/components` opens the door for itself, and a wipe there would be
 * a page that clears the reader's demo app because they opened a row. So this is
 * the one writer in the file that must not use `clearApp`, and the assertion is
 * about what it leaves standing rather than what it writes.
 */
describe('holding the door open', () => {
  const OTHER = `${STATE_PREFIX}store.savedArticles`;

  it('leaves every other key alone', () => {
    const store = new FakeStorage() as unknown as Storage;
    store.setItem(OTHER, JSON.stringify({ items: [{ url: 'https://example.org' }] }));
    store.setItem(`${CACHE_PREFIX}feeds/abc.json`, '{"data":[]}');

    holdTheDoorOpen(store);

    expect(store.getItem(OTHER)).toContain('example.org');
    expect(store.getItem(`${CACHE_PREFIX}feeds/abc.json`)).toBe('{"data":[]}');
    expect(payload(store, 'session').entitlement).toMatchObject({ appAccess: true });
  });

  it('leaves a session that is already through the door as it is', () => {
    const store = new FakeStorage() as unknown as Storage;
    const mine = {
      account: { email: 'me@example.org', name: 'Me' },
      entitlement: { tier: 'paid', appAccess: true },
    };
    store.setItem(`${STATE_PREFIX}store.session`, JSON.stringify(mine));

    holdTheDoorOpen(store);

    expect(payload(store, 'session')).toEqual(mine);
  });

  it('writes over a session that is shut, or unreadable', () => {
    for (const raw of [JSON.stringify({ entitlement: { appAccess: false } }), 'not json']) {
      const store = new FakeStorage() as unknown as Storage;
      store.setItem(`${STATE_PREFIX}store.session`, raw);

      holdTheDoorOpen(store);

      expect(payload(store, 'session').entitlement).toMatchObject({ appAccess: true });
    }
  });

  /**
   * A browser with site data switched off throws on every accessor, and this is
   * called from an effect: measured against such a store, `/components` rendered
   * its error boundary and none of its 46 rows, because the write that answers a
   * failed read sat in that read's own `catch`. A frame that draws the door is
   * the correct outcome here, and it is only reachable if this returns.
   */
  it('says nothing when the store refuses both the read and the write', () => {
    const blocked = {
      getItem: () => {
        throw new Error('The operation is insecure.');
      },
      setItem: () => {
        throw new Error('The operation is insecure.');
      },
    } as unknown as Storage;

    expect(() => holdTheDoorOpen(blocked)).not.toThrow();
  });
});

/**
 * Issue #112: the bypass says what it is, and cannot reach a production build.
 *
 * A door that quietly opens is worse than one that asks. Nothing about a seeded
 * session looks different from a sign-in from inside the app, so two things are
 * held here: that the mark is written, and that the app prints it under the same
 * name. The second is the one that rots — two files, one string, and a rename in
 * either would leave a bypass with no marker and nothing in the build to say so.
 */
describe('saying that the door was held open', () => {
  const GALLERY = readFileSync(resolve(ROOT, 'apps/mobile/src/gallery/Gallery.tsx'), 'utf8');

  it('marks the session it writes, under a name outside the app’s own stores', () => {
    const store = new FakeStorage() as unknown as Storage;

    holdTheDoorOpen(store);

    expect(store.getItem(SEEDED_KEY)).not.toBeNull();
    // Not inside the app's state store: `persist()` writes back only the keys a
    // slice declares, so anything invented under `store.` is dropped on the app's
    // first write, and this is not the core's state.
    expect(SEEDED_KEY.startsWith(STATE_PREFIX)).toBe(false);
    // And the account is obviously not a person, which is the half a developer
    // sees on the profile screen without knowing this key exists.
    expect(payload(store, 'session').account).toMatchObject({ name: 'Handbuch' });
  });

  it('is the same string the app reads', () => {
    expect(GALLERY).toContain(`const SEEDED_KEY = '${SEEDED_KEY}'`);
    expect(GALLERY).toContain('Session seeded by the handbook');
  });

  it('takes the mark away with a fixture, which is a whole state', () => {
    const store = new FakeStorage() as unknown as Storage;
    holdTheDoorOpen(store);
    // The site's own setting lives under the same prefix, and a fixture is about
    // the app's state and not about the reader's. Clearing by prefix would put
    // somebody back to "System" because they asked to see the app signed out.
    store.setItem('handbook:appearance', 'dark');

    applyFixture(store, 'fresh');

    expect(store.getItem(SEEDED_KEY)).toBeNull();
    expect(store.getItem('handbook:appearance')).toBe('dark');
  });

  /**
   * And the reason it cannot reach a production build is not a `__DEV__` branch.
   *
   * ADR 0025 measured that a route component returning `null` outside a
   * development build is still pre-rendered into the export as a blank public
   * page, so guarding a component is not the same as keeping something out of a
   * build. What keeps this out is simpler: the code that opens the gate is this
   * package's, and the app's bundle has none of it.
   */
  it('keeps the bypass itself out of the app', () => {
    const offenders = sources(resolve(ROOT, 'apps/mobile/src')).filter((file) =>
      readFileSync(file, 'utf8').includes('holdTheDoorOpen'),
    );
    expect(offenders).toEqual([]);
  });
});
