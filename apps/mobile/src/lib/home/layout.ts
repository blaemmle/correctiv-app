import { useSyncExternalStore } from 'react';

import {
  DEFAULT_HOME_LAYOUT,
  homeLayoutDocument,
  parseHomeLayout,
  reportLayoutProblems,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';

import { HOME_MODULES } from './modules';

/** The module names this host holds a renderer for — ADR 0036 §14, from the map itself. */
const RENDERABLE: ReadonlySet<string> = new Set(Object.keys(HOME_MODULES));

/**
 * Where a document this app did not compile in arrives, and the one place it can.
 *
 * ADR 0036 §4 has the app fetching its layout and drawing from the copy it kept. The
 * fetch is not built; **the copy is what this key is**, and the workbench's home-layout
 * editor is currently its only writer. Same origin on the web target means the
 * workbench's `localStorage` IS this app's, which is the seam every storage fixture in
 * `apps/workbench/src/preview/frame/seed.ts` already travels — and the only one that
 * works against the published export, where `expo export` has left no dev handle to
 * dispatch through.
 *
 * **Named for who writes it, not for what it holds.** `workbench:` is the prefix the
 * shell already uses for the two keys it owns (`workbench:seeded`,
 * `workbench:appearance`), and issue #112's rule applies here for the same reason it
 * applied to a seeded session: a home screen that quietly differs from the document in
 * the repository is worse than one that says who changed it. One greppable string in
 * two packages, held together by `apps/workbench/test/preview/home-document.test.ts`.
 *
 * It is deliberately outside the app's own MMKV prefixes. `persist()` writes back only
 * the keys a slice declares, so anything invented under `correctiv.state\store.` is
 * dropped on the app's first write; this is not the core's state and must not look like
 * it.
 */
export const HOME_LAYOUT_OVERRIDE_KEY = 'workbench:home-layout';

/**
 * The override as it stands, or null.
 *
 * Text rather than a parsed value, because the text is what says whether anything
 * changed, and that is the question `homeLayout()` below asks on every render.
 *
 * Guarded rather than platform-split. `localStorage` is a web thing and this file is
 * shared by all three targets; a `.web.ts` sibling would be a second copy of the parse
 * and the cache for the sake of five lines. React Native has no `localStorage`, a
 * browser with site data switched off throws on the accessor, and both answer the same
 * way here: there is no override, so the bundled document stands.
 */
function overrideText(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(HOME_LAYOUT_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

/** Never throws: an unparsable override is a document that is not an object (§9). */
function documentFrom(text: string | null): unknown {
  if (text === null) return homeLayoutDocument;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

let read: { text: string | null; layout: HomeLayout } | null = null;

/**
 * The layout Home draws: the override if there is one, the bundled document otherwise.
 *
 * **Once per document, not once per render**, which is what ADR 0036 §7's report is
 * worth. A report made during render is made again on every feed that lands, every pull
 * to refresh and every theme change — a log nobody can read and, once there is a
 * provider behind the port (#95), a quota spent on one typo. The cache is keyed on the
 * override's raw text, so a render re-parses only when the document actually changed,
 * and the value it returns is referentially stable in between, which is what
 * `useSyncExternalStore` requires of a snapshot.
 *
 * It is lazy rather than module scope for one reason: `configurePlatform()` runs in
 * `app/_layout.tsx`, and a report made while this module is being imported would go to
 * the core's default reporter, which reports nowhere. By the first render the host's is
 * registered.
 *
 * A document that does not parse at all costs the override and not the screen:
 * `DEFAULT_HOME_LAYOUT` is bundled and always usable, which is §10's promise and the
 * app's half of §9.
 */
export function homeLayout(): HomeLayout {
  const text = overrideText();
  if (read && read.text === text) return read.layout;
  const { layout, problems } = parseHomeLayout(documentFrom(text), RENDERABLE);
  reportLayoutProblems(problems);
  read = { text, layout: layout ?? DEFAULT_HOME_LAYOUT };
  return read.layout;
}

/**
 * When the override changes, which on the web target is a `storage` event.
 *
 * The browser fires that event in every same-origin document **except** the one that
 * made the change, so a write from the workbench arrives here and a write from this app
 * would not. That asymmetry is exactly right: nothing in the app writes this key.
 *
 * A no-op everywhere else. React calls a subscriber's unsubscribe on unmount and is
 * given one either way.
 */
function subscribeToLayout(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === HOME_LAYOUT_OVERRIDE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/**
 * The layout, re-read when somebody writes a new one.
 *
 * `useSyncExternalStore` rather than state and an effect, because the document is not
 * this component's to own: it is read at render time from storage, and the subscription
 * exists only so that a screen already on the phone redraws instead of waiting for a
 * reload. The same function serves as the snapshot and as the server snapshot — the
 * static export prerenders each route, and there the bundled document is the only one
 * there can be.
 */
export function useHomeLayout(): HomeLayout {
  return useSyncExternalStore(subscribeToLayout, homeLayout, homeLayout);
}
