/**
 * Storage fixtures: what the app finds when it boots.
 *
 * The shell and the app share an origin, so `window.localStorage` here **is** the
 * app's storage. Writing it before the frame is pointed at a route is therefore
 * the whole mechanism — no handshake, no cooperation from the app, and it works
 * against the static export too, where the dev handle does not exist.
 *
 * This is the half of state control a dispatch cannot do: `onboardingDone` is
 * read by the root layout before the first render, and the feed cascade consults
 * the cache on its way up. Everything that can wait until after boot goes through
 * the handle instead (`frame/handle.ts`), because that speaks the core's
 * vocabulary rather than copying its storage layout.
 *
 * Two things about the layout, both load-bearing and both cheap to get wrong:
 * `persist()` writes back only the keys a slice declares, so anything invented
 * here is dropped on the app's first write; and a payload that is not valid JSON
 * is not ignored but **deleted**, and the slice starts empty.
 */

/**
 * The app's two MMKV stores, as they land in `localStorage` on the web target.
 *
 * MMKV's web build gives each instance its own key prefix, `<id>` followed by a
 * backslash — see `LOCAL_STORAGE_KEY_WILDCARD` in `react-native-mmkv`. The ids
 * come from `apps/mobile/src/lib/platform/expo.ts`, which is the only place the
 * app names them, and `test/preview/seed.test.ts` holds the two spellings
 * together. They are also the reason a fixture cannot accidentally seed a bookmark
 * into the cache: the app keeps what the reader chose and what it may evict in two
 * separate stores.
 */
const STATE_PREFIX = 'correctiv.state\\';
const CACHE_PREFIX = 'correctiv.cache\\';

/** `packages/app-core/src/services/cache.service.ts` — djb2, kept identical. */
function fileKey(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const blobKey = (ns: string, key: string) => `${CACHE_PREFIX}${ns}/${fileKey(key)}.json`;

/** Feeds that carry articles: `CONTENT_FEEDS`, i.e. everything but `europe`. */
const CONTENT_FEEDS = ['recherchen', 'faktencheck', 'klima', 'schweiz', 'lokal', 'salon5'];

const ONBOARDED = {
  onboardingDone: true,
  pushOptIn: false,
  textScale: 1,
  newsletter: { spotlight: false, spotlightCh: false, klima: false },
  theme: 'system',
};

/**
 * Through the door. The root layout renders the gate in place of every route
 * until the session carries an entitlement with the app in it, so every fixture
 * that wants to show a screen has to carry this. It is what a sign-in leaves on
 * disk: the account and the entitlement, no status. `stores/session.ts` derives
 * the status from the account on hydration.
 */
const SIGNED_IN = {
  account: { email: 'alex.beispiel@example.org', name: 'Alex Beispiel' },
  entitlement: {
    tier: 'paid',
    appAccess: true,
    source: 'paid',
    validUntil: null,
    localAreas: [],
    memberSince: '2026-03-04T09:12:00.000Z',
  },
};

/**
 * The same, under a name that is obviously not a person.
 *
 * What `holdTheDoorOpen` writes when it opens the gate for a frame. The account
 * name reaches the app's profile screen, so a developer looking at a framed
 * screen sees "Handbuch" where an account name belongs and knows the session was
 * not signed into. German, because this one string is read by the app's own user
 * interface rather than by a developer; the marker beside it is not.
 */
const HELD_OPEN = {
  account: { email: 'handbuch@example.org', name: 'Handbuch' },
  entitlement: SIGNED_IN.entitlement,
};

/** A member of the 0 € tier: signed in, and the app is not part of it. */
const NO_ACCESS = {
  account: { email: 'frei@example.org', name: 'Frei' },
  entitlement: {
    tier: 'free',
    appAccess: false,
    source: null,
    validUntil: null,
    localAreas: [],
    memberSince: '2026-03-04T09:12:00.000Z',
  },
};

export interface Fixture {
  id: string;
  label: string;
  /** What this is for, in one line. Shown next to the control. */
  hint: string;
  write(store: Storage): void;
}

const kv = (store: Storage, slice: string, value: unknown) =>
  store.setItem(`${STATE_PREFIX}store.${slice}`, JSON.stringify(value));

/**
 * The mark this tool leaves when it opens the app's door for a frame.
 *
 * Issue #112: a door that quietly opens is worse than one that asks. Nothing
 * about a seeded session looks different from a real sign-in from inside the
 * app, so the app is told, in one key, and prints it where a developer will see
 * it — `apps/mobile/src/gallery/Gallery.tsx`, which is the page every framed
 * component is drawn on.
 *
 * Outside the app's own store on purpose. `persist()` writes back only the keys a
 * slice declares, so anything invented under `store.` is dropped on the app's
 * first write; this is not the core's state and must not look like it. It is also
 * one greppable string, which is what the issue asks for: `workbench:seeded`
 * appears in exactly two files, and `test/preview/seed.test.ts` fails if the two
 * ever spell it differently.
 *
 * The bypass itself cannot reach a production build for a simpler reason than a
 * `__DEV__` branch: it is not in the app. `holdTheDoorOpen` is this package's
 * code, the app's own bundle contains nothing that opens its gate, and the same
 * test asserts that too.
 */
export const SEEDED_KEY = 'workbench:seeded';

/**
 * Everything the app owns, plus the mark above, and nothing else.
 *
 * `SEEDED_KEY` by name and not by its `workbench:` prefix, which is the kind of
 * shortcut that would be wrong the day something else took the prefix — and one
 * already has: `theme.ts` keeps the reader's own appearance setting under
 * `workbench:appearance`, and a fixture that wiped the prefix would put the site
 * back to "System" because somebody asked to see the app signed out.
 */
function clearApp(store: Storage): void {
  for (const key of Object.keys(store)) {
    if (key.startsWith(STATE_PREFIX) || key.startsWith(CACHE_PREFIX) || key === SEEDED_KEY) {
      store.removeItem(key);
    }
  }
}

export const FIXTURES: Fixture[] = [
  {
    id: 'fresh',
    label: 'Fresh install',
    hint: 'Nothing stored. The app starts at the door, signed out.',
    write: () => {},
  },
  {
    id: 'signed-in',
    label: 'Signed in',
    hint: "A member's first start: through the door, into the onboarding.",
    write: (s) => kv(s, 'session', SIGNED_IN),
  },
  {
    id: 'no-access',
    label: 'Signed in, no app access',
    hint: "The door's fourth state: a 0 € member, sent to the upgrade.",
    write: (s) => kv(s, 'session', NO_ACCESS),
  },
  {
    id: 'onboarded',
    label: 'Onboarded',
    hint: 'The ordinary case: the app starts on Home.',
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
    },
  },
  {
    id: 'saved',
    label: 'Saved articles',
    hint: '/gespeichert is otherwise empty and shows only its empty state.',
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      kv(s, 'savedArticles', {
        items: [
          {
            url: 'https://correctiv.org/faktencheck/2026/07/29/roboter-greift-menschen-an-video-ist-inszeniert/',
            title: 'Roboter greift Menschen an: Video ist inszeniert',
            kicker: 'Faktencheck',
            rating: 'falsch',
            savedAt: '2026-08-30T10:00:00.000Z',
          },
          {
            url: 'https://correctiv.org/russland/2026/08/11/russisches-haus-ein-ende-fuer-propaganda-und-spionage/',
            title: 'Russisches Haus, ein Ende für Propaganda und Spionage?',
            kicker: null,
            rating: null,
            savedAt: '2026-08-29T08:00:00.000Z',
          },
        ],
      });
    },
  },
  {
    id: 'interests',
    label: 'Interests picked',
    hint: 'A personalised Home: extra feeds, and modules in a different order.',
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      kv(s, 'interests', { selected: ['klima', 'faktenchecks', 'jugend'] });
    },
  },
  {
    id: 'submitted',
    label: 'Callout answered',
    hint: 'The form then shows its thanks instead of its questions.',
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      kv(s, 'participation', {
        submissions: [
          {
            calloutSlug: 'zukunft-von-correctiv',
            answers: { themen: ['klima', 'lokal'], wunsch: 'Mehr Lokales.', kontakt: '' },
            submittedAt: '2026-08-31T12:00:00.000Z',
          },
        ],
      });
    },
  },
  {
    id: 'bundle',
    label: 'Bundled content only',
    hint: "Forces the bundle fallback, the feeds' 'offline' status.",
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', ONBOARDED);
      // A STALE and EMPTY entry, which is the only combination that reaches the
      // fallback: fresh-and-empty short-circuits to `ready` with nothing in it
      // (`[]` is truthy), and no entry at all would work too but leaves the
      // 8-second fetch timeout in the way on a host that can reach the network.
      const stale = JSON.stringify({ data: [], ts: Date.now() - 16 * 60 * 1000 });
      for (const key of CONTENT_FEEDS) s.setItem(blobKey('feeds', key), stale);
    },
  },
  {
    id: 'big-type',
    label: 'Largest text scale',
    hint: 'A++ (1.15), the setting the reader breaks under first.',
    write: (s) => {
      kv(s, 'session', SIGNED_IN);
      kv(s, 'settings', { ...ONBOARDED, textScale: 1.15 });
    },
  },
];

/**
 * Wipes the app's storage and writes one fixture.
 *
 * Always a full wipe first, so a fixture describes a whole state rather than a
 * patch on whatever the last visit left behind. Seeding is a boot-time input,
 * not durable state: the app's own `persist()` overwrites these keys 250 ms after
 * anything changes.
 *
 * An id nothing answers to leaves the storage alone instead of wiping it. A link
 * naming a fixture that has since been renamed should open the app, not clear
 * whatever the person looking at it had set up.
 */
export function applyFixture(store: Storage, id: string): void {
  const chosen = FIXTURES.find((f) => f.id === id);
  if (!chosen) return;
  clearApp(store);
  chosen.write(store);
}

/**
 * Opens the door, and touches nothing else.
 *
 * `applyFixture` above is for someone who asked for a state: it wipes first, so a
 * fixture describes a whole state rather than a patch. That is wrong for a frame
 * that appears because a reader opened a component's page — they asked to see a
 * button drawn, not to have the demo app's saved articles cleared.
 *
 * So: the session key, and only when the door is actually shut. Nothing else is
 * read or written, and a reader who is already signed in keeps the account they
 * signed in with.
 *
 * A frame does need this. The app's root layout renders the gate INSTEAD of the
 * router until the session carries an entitlement, so a frame pointed at
 * `/gallery` without one draws the sign-in form, which is what the link out of
 * the component reference did for every reader of the published site. Storage is the only
 * key that works there, because the static export carries no dev handle to
 * dispatch through, which is the same argument the file header makes.
 *
 * **It says so, which is the whole of issue #112.** The account it writes is
 * named `Handbuch` rather than a plausible person, and it sets `SEEDED_KEY`
 * beside it; the app's gallery prints one line when that key is there, so a
 * developer looking at a framed component can tell a held door from a sign-in.
 * A door that quietly opens is worse than one that asks.
 *
 * `settings` is deliberately left alone here: the onboarding redirect fires only
 * from `/`, and nothing on `/components/<group>/<name>` starts there. What it
 * writes does outlive the page, like every fixture — the next visit to `/preview`
 * that names no fixture finds this session rather than the door. `/preview`'s own
 * main frame DOES start at `/`, so it calls `ensureOnboarded` alongside this one
 * below rather than widening this function's contract for a caller that never
 * needed it.
 *
 * **Two `try` blocks and not one.** A store that cannot be read is the ordinary
 * case, and the answer to it is to write; a store that cannot be *written* is a
 * browser with site data switched off, and there is no answer to it at all. One
 * block put the write in the catch of the read, so a blocked store threw out of
 * the effect that calls this and React unmounted the page: measured against a
 * `localStorage` whose accessors throw `SecurityError`, the component reference
 * rendered its error boundary and none of its rows. A frame that draws the door
 * is worse than one that draws a component and far better than no reference page.
 */
export function holdTheDoorOpen(store: Storage): void {
  try {
    const raw = store.getItem(`${STATE_PREFIX}store.session`);
    const held = raw
      ? (JSON.parse(raw) as { entitlement?: { appAccess?: unknown } }).entitlement?.appAccess
      : false;
    if (held === true) return;
  } catch {
    // Unparsable is the same as shut. `persist()` deletes a payload that is not
    // valid JSON, so writing over it loses nothing that would have survived.
  }
  try {
    kv(store, 'session', HELD_OPEN);
    store.setItem(SEEDED_KEY, new Date().toISOString());
  } catch {
    // Site data switched off. Nothing can be seeded, and nothing may throw.
  }
}

/**
 * Marks onboarding done for the session `holdTheDoorOpen` admitted, so the
 * root layout's redirect does not trade the sign-in form for "Los geht's".
 *
 * A door held open with no completed onboarding is the same fault one screen
 * later: still nothing behind it for a tool built to show the Home screen —
 * `/preview` with the home tool open and no `s=` landed here, edits reaching
 * storage and no screen for them to redraw. `AppFrame.tsx`'s routes are never
 * `/`, so onboarding never entered play there and `holdTheDoorOpen` was right
 * to leave `settings` alone for it; `/preview`'s own frame starts at `/` and
 * needs both.
 *
 * Gated on `SEEDED_KEY`, the same marker `holdTheDoorOpen` writes, so this
 * only ever completes the synthetic "Handbuch" account's onboarding — never a
 * real visitor's own progress, which is exactly as much theirs to skip as
 * their sign-in is. Additive like `holdTheDoorOpen`: an existing `settings`
 * value keeps every field it already had.
 */
export function ensureOnboarded(store: Storage): void {
  try {
    if (!store.getItem(SEEDED_KEY)) return;
    const raw = store.getItem(`${STATE_PREFIX}store.settings`);
    const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (settings.onboardingDone === true) return;
    kv(store, 'settings', { ...settings, onboardingDone: true });
  } catch {
    // Unparsable or unwritable: the same two faults `holdTheDoorOpen` guards
    // against, and the same answer — nothing here may throw.
  }
}
