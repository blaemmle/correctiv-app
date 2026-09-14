import { platform } from '../ports';
import { fetchText, type FetchTextOptions } from './http';

/**
 * The one cache in this codebase, in two layers: an in-memory session map on top
 * of the host's `BlobStore` port.
 *
 * There used to be two of these — the core's, behind a synchronous port, and the
 * Expo app's `cachedFetch`, straight onto AsyncStorage with its own policies and
 * headers. Same job, two TTLs, two sets of failure behaviour. This is both,
 * merged: `getCached`/`setCached` for typed objects (feeds, videos, articles) and
 * `fetchCachedText` for the raw bodies that produce them.
 *
 * Everything here is best-effort. A read that fails is a miss, a write that fails
 * is forgotten — a broken cache must never take a screen down with it.
 *
 * ## It is bounded, and that is not decoration
 *
 * The TTLs control freshness, not size: an expired entry is still served as the
 * offline fallback, so nothing here ever removed anything. Under AsyncStorage
 * that was a disk filling slowly. Under MMKV it is resident memory — the store is
 * mapped, so every kilobyte the cache ever wrote is a kilobyte the process holds,
 * and [ADR 0026](../../../../adr/0026-react-native-review-and-hardening.md) §4
 * measured 4 MiB of cache as 4.55 MiB of settled process PSS. A cache with a TTL
 * and no ceiling is a leak on a slow timer.
 *
 * So there are three limits and a least-recently-used order, below. They apply to
 * both layers at once: an eviction drops the session entry AND asks the host to
 * delete the persisted blob, because deleting only one of them means the other
 * one grows unwatched.
 */

// --- the bound ----------------------------------------------------------------

/*
 * The three limits below were measured against this app's own content on
 * 2026-09-14, not guessed. Every figure is the length of the `{ data, ts }`
 * payload this file actually writes, taken from the offline bundles under
 * `apps/mobile/src/lib/{articles,podcasts}/` and from one live round of each
 * cascade against correctiv.org:
 *
 *   cached shape                        namespace   bytes
 *   ----------------------------------  ----------  ------------------------------
 *   feed, page 1 (20 items), live REST  feeds       13,743 - 14,301
 *   feed grown to 100 items (bundle)    feeds       5,123 - 71,365, six of them
 *   one FeedItem inside those           feeds       428 - 1,183, mean 701
 *   one extracted article (15 bundled)  articles    4,635 - 21,283, mean 9,715
 *   all seven podcast shows             podcasts    42,318
 *   Spotlight, 12 issues                spotlight   5,112
 *   PeerTube, 12 videos                 funfacts    7,749
 *   one search, 20 hits                 search      14,127
 *   one article page's HTML             http        77,831 - 125,732, mean 109,437
 *
 * The live surface — six feeds, the podcasts, Spotlight, two video rails and a
 * search — is about 161 KB together, and 306 KB with every feed paginated out to
 * the 100 items the offline bundle holds. Everything past that is what the reader
 * opened.
 */

/**
 * Twice the largest single payload measured (125,732, an article page's HTML) and
 * 3.7× the largest feed. Nothing the app writes today comes near it: a feed would
 * have to grow past roughly 370 items, which is eighteen presses of a "mehr laden"
 * no screen offers yet. It is the guard against the one entry that is wrong rather
 * than big — a page that answers with a 2 MB error document, a feed that stopped
 * paginating.
 */
const MAX_ENTRY_BYTES = 256 * 1024;

/**
 * Half of the 4 MiB whose resident cost ADR 0026 §4 measured, so the cache's worst
 * case is about 2.3 MiB of process memory rather than an extrapolation from one.
 * It holds the 306 KB live surface many times over: the remaining ~1.8 MiB is
 * about 180 articles at the 9,715-byte mean, or about 16 page bodies at 109,437.
 *
 * The web target is the other half of the argument. There the store is
 * `localStorage`, the per-origin quota is about 5 MiB, and since
 * [ADR 0024](../../../../adr/0024-the-handbook-owns-the-root.md) the handbook
 * shares that origin with the app — so a budget near the quota would be an app
 * that evicts the site it is published inside.
 */
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

/**
 * The article-count limit. The live surface is about eleven entries; the rest of
 * this is what the reader opened inside the article TTL's 24 hours. 128 entries at
 * the 9,715-byte article mean is 1.19 MiB, inside the budget above — which is the
 * point of having both: the count binds on many small entries, the budget binds on
 * a few large ones, and neither alone catches the other's case.
 */
const MAX_ENTRIES = 128;

// --- the two layers, and the ledger that spans them ---------------------------

interface CacheEntry {
  data: unknown;
  ts: number;
}

/** What the ledger knows about one entry. Never the entry's data. */
interface LedgerEntry {
  ns: string;
  key: string;
  /** Length of the persisted `{ data, ts }` payload. */
  bytes: number;
  /** Written or read, whichever was last — the least-recently-used order. */
  usedAt: number;
}

const memory = new Map<string, CacheEntry>();

/**
 * Every entry the cache holds, in either layer, and nothing else.
 *
 * **This is what makes the bound real rather than per-session.** The session map
 * is empty at every launch, so a policy that could only see it would let the
 * persisted store grow forever across restarts — and with MMKV that store is
 * mapped into the process, so it would be the leak this bound exists to prevent.
 * The ledger is therefore persisted too, as one small blob.
 *
 * It is bookkeeping, not truth: a ledger that cannot be read is an empty one, and
 * the entries it forgot become orphans that no eviction reaches. That costs at
 * most one previous budget of dead weight, and an orphan is re-adopted the moment
 * anything reads it (`readEntry`), so the loss is bounded and self-healing.
 *
 * **The reader's own data is not in here and cannot be.** Bookmarks, settings and
 * the session are `KeyValueStore`, a port this file never names; eviction walks
 * this ledger and speaks only to `blobs.delete`. There is no key in the ledger
 * that the cache did not put there itself.
 */
const ledger = new Map<string, LedgerEntry>();

/**
 * Where the ledger itself lives.
 *
 * Its own namespace, and a name that is not a hash, so no `setCached` call can
 * collide with it: every entry this file writes is stored under `<djb2>.json`,
 * and `ledger.json` is not a djb2 hash of anything.
 *
 * It is outside the budget it enforces, and small enough for that to be fair: a
 * full 128 entries of article URLs is about 20 KB, under one per cent of it.
 */
const LEDGER_NS = 'cache-ledger';
const LEDGER_NAME = 'ledger.json';
const LEDGER_VERSION = 1;

/** Set once the persisted ledger has been read (or has failed to read) this session. */
let ledgerLoaded: Promise<void> | null = null;

const memKey = (ns: string, key: string) => `${ns}:${key}`;

/**
 * Exported because it is not an internal detail: the preview shell has to name the
 * very same blob to seed a feed's cache, and re-implements this from the outside
 * (`apps/handbook/src/workbench/frame/seed.ts`).
 * `apps/handbook/test/workbench/seed.test.ts` holds the two versions together —
 * without it a changed hash makes every fixture silently do nothing.
 */
export function fileKey(key: string): string {
  // djb2 — stable, and short enough to be a file name on every host
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const blobName = (key: string) => `${fileKey(key)}.json`;

function loadLedger(): Promise<void> {
  ledgerLoaded ??= (async () => {
    try {
      const raw = await platform().blobs.read(LEDGER_NS, LEDGER_NAME);
      if (raw === null) return;
      const parsed = JSON.parse(raw) as { v?: number; entries?: LedgerEntry[] };
      if (parsed.v !== LEDGER_VERSION || !Array.isArray(parsed.entries)) return;
      for (const entry of parsed.entries) {
        if (typeof entry?.ns !== 'string' || typeof entry?.key !== 'string') continue;
        ledger.set(memKey(entry.ns, entry.key), {
          ns: entry.ns,
          key: entry.key,
          bytes: Number(entry.bytes) || 0,
          usedAt: Number(entry.usedAt) || 0,
        });
      }
    } catch {
      // An unreadable ledger is an empty one. See the note on `ledger` for what
      // that costs and why it heals.
    }
  })();
  return ledgerLoaded;
}

async function saveLedger(): Promise<void> {
  try {
    const payload = JSON.stringify({ v: LEDGER_VERSION, entries: [...ledger.values()] });
    await platform().blobs.write(LEDGER_NS, LEDGER_NAME, payload);
  } catch {
    // Bookkeeping is best-effort like everything else here.
  }
}

function totalBytes(): number {
  let sum = 0;
  for (const entry of ledger.values()) sum += entry.bytes;
  return sum;
}

/** Drops one entry from BOTH layers. The only place in this file that deletes. */
async function drop(id: string, entry: LedgerEntry): Promise<void> {
  memory.delete(id);
  ledger.delete(id);
  try {
    await platform().blobs.delete(entry.ns, blobName(entry.key));
  } catch {
    // A delete that fails leaves a blob the ledger no longer names — an orphan,
    // which the next read re-adopts. Never worth failing a cache write over.
  }
}

/**
 * Least-recently-used eviction, down to both limits.
 *
 * `keep` is the entry the current write just stored: a single `setCached` must
 * never be allowed to evict itself, which is what would happen the moment one
 * entry alone crossed a limit.
 *
 * Linear scan per eviction, over at most `MAX_ENTRIES` + 1 entries, and only when
 * a limit is actually crossed. A heap would be faster and would be a second
 * structure to keep in step with the ledger.
 */
async function evictToBudget(keep: string): Promise<void> {
  while (ledger.size > MAX_ENTRIES || totalBytes() > MAX_TOTAL_BYTES) {
    let victimId: string | null = null;
    let victim: LedgerEntry | null = null;
    for (const [id, entry] of ledger) {
      if (id === keep) continue;
      if (!victim || entry.usedAt < victim.usedAt) {
        victimId = id;
        victim = entry;
      }
    }
    if (!victimId || !victim) return; // only `keep` is left, and it stays
    // eslint-disable-next-line no-await-in-loop
    await drop(victimId, victim);
  }
}

/** Records a read against the LRU order. Session-only; the next write persists it. */
function touch(id: string): void {
  const known = ledger.get(id);
  if (known) known.usedAt = Date.now();
}

async function readEntry<T>(ns: string, key: string): Promise<{ data: T; ts: number } | null> {
  try {
    const raw = await platform().blobs.read(ns, blobName(key));
    if (raw === null) return null;
    const entry = JSON.parse(raw) as { data: T; ts: number };
    const id = memKey(ns, key);
    if (!ledger.has(id)) {
      // An entry the ledger does not know: a previous session's, whose ledger was
      // lost, or one a fixture wrote straight into the store. Adopting it here is
      // what keeps "everything persisted is evictable" true without a port that
      // can list. Adoption grows the ledger and not the store, so it does not
      // evict; the next `setCached` is where the limits are applied.
      ledger.set(id, { ns, key, bytes: raw.length, usedAt: Date.now() });
    }
    return entry;
  } catch {
    return null;
  }
}

/** A cached value, but only while it is younger than `ttlMs`. */
export async function getCached<T>(ns: string, key: string, ttlMs: number): Promise<T | null> {
  await loadLedger();
  const id = memKey(ns, key);
  const now = Date.now();
  const mem = memory.get(id);
  if (mem) {
    touch(id);
    return now - mem.ts < ttlMs ? (mem.data as T) : null;
  }

  const entry = await readEntry<T>(ns, key);
  if (!entry) return null;
  memory.set(id, entry);
  touch(id);
  return now - entry.ts < ttlMs ? entry.data : null;
}

/** Also returns expired entries — for stale-while-revalidate and offline fallback. */
export async function getStale<T>(ns: string, key: string): Promise<T | null> {
  await loadLedger();
  const id = memKey(ns, key);
  const mem = memory.get(id);
  if (mem) {
    touch(id);
    return mem.data as T;
  }
  const entry = await readEntry<T>(ns, key);
  if (!entry) return null;
  touch(id);
  return entry.data;
}

/**
 * Stores one entry, then brings the cache back inside its limits.
 *
 * An oversized payload is refused outright rather than stored in memory and left
 * off the disk: the session map is half the thing being bounded. Whatever was
 * under that key stays where it is — it is older, but a cache serving a slightly
 * older answer is a cache doing its job, and its TTL still governs it.
 */
export async function setCached(ns: string, key: string, data: unknown): Promise<void> {
  const entry: CacheEntry = { data, ts: Date.now() };
  const payload = JSON.stringify(entry);
  if (payload.length > MAX_ENTRY_BYTES) return;

  await loadLedger();
  const id = memKey(ns, key);
  memory.set(id, entry);
  ledger.set(id, { ns, key, bytes: payload.length, usedAt: entry.ts });
  try {
    await platform().blobs.write(ns, blobName(key), payload);
  } catch {
    // the blob cache is a nicety, not a must — and the entry still occupies the
    // session map, so it stays in the ledger and stays evictable
  }
  await evictToBudget(id);
  await saveLedger();
}

/**
 * Which of network and cache gets asked first.
 *
 * - `network-first` — feeds. Keeps the home screen current (that is the demo's
 *   first impression) and falls back to the cache when the request fails.
 * - `cache-first` — article pages and other rarely changing resources. A fresh
 *   entry answers without touching the network at all.
 *
 * Both end at the same place: stale beats nothing. Deliberately not a query
 * library — the offline order has to be explicit and identical on both hosts.
 */
export type CachePolicy = 'network-first' | 'cache-first';

export interface FetchCachedOptions extends FetchTextOptions {
  policy?: CachePolicy;
  /** Freshness window for `cache-first` (ms). Default 10 minutes. */
  ttlMs?: number;
}

const TEXT_NS = 'http';
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** A text resource, cached under `key`. See `CachePolicy` for the two orders. */
export async function fetchCachedText(
  key: string,
  url: string,
  options: FetchCachedOptions = {},
): Promise<string> {
  const { policy = 'network-first', ttlMs = DEFAULT_TTL_MS, ...fetchOptions } = options;

  if (policy === 'cache-first') {
    const fresh = await getCached<string>(TEXT_NS, key, ttlMs);
    if (fresh !== null) return fresh;
    try {
      const body = await fetchText(url, fetchOptions);
      await setCached(TEXT_NS, key, body);
      return body;
    } catch (err) {
      const stale = await getStale<string>(TEXT_NS, key);
      if (stale !== null) return stale;
      throw err;
    }
  }

  try {
    const body = await fetchText(url, fetchOptions);
    await setCached(TEXT_NS, key, body);
    return body;
  } catch (err) {
    const stale = await getStale<string>(TEXT_NS, key);
    if (stale !== null) return stale;
    throw err;
  }
}

/**
 * Test helper — forgets this session: the entries in memory and the ledger's copy
 * of what is persisted. The `BlobStore` is owned by the host and is untouched, so
 * the next call reloads the ledger from it and the persisted entries still answer.
 */
export function clearMemoryCache(): void {
  memory.clear();
  ledger.clear();
  ledgerLoaded = null;
}

/** The limits, for the tests that pin them. Not a runtime knob. */
export const CACHE_LIMITS = {
  maxEntryBytes: MAX_ENTRY_BYTES,
  maxTotalBytes: MAX_TOTAL_BYTES,
  maxEntries: MAX_ENTRIES,
} as const;
