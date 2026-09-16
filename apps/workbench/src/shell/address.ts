import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import type { SectionId, ViewDeclaration } from './views';

/**
 * The hash, on every route, as one grammar.
 *
 * `#<head>?<params>`. The head is an app route on `/preview` (`/artikel`), a
 * heading id on a document (`the-four-ports`), and empty elsewhere. The
 * parameters are the shell's own — `tools`, `open`, `full` — plus everything the
 * open view keeps in `rest`, which on the preview is the five original frame
 * parameters and on the component route is the device and the rendering.
 *
 * **The two halves cannot collide**, which is what lets one grammar serve both: an
 * app route starts with `/` and a heading id never does, because `lib/slug.ts`
 * strips everything but letters, digits, spaces and hyphens. The board's row ids
 * come through the same function, so the guarantee covers every head this parses
 * and not only the documents.
 *
 * **A parameter is written only when it differs from the view's declared
 * default.** That is what keeps a document clean: a reader who toggled nothing
 * keeps a plain `#the-four-ports`, and the link most people paste is what it was
 * before this file existed. It is also what makes a stale parameter harmless —
 * the hash goes with the route, and what it says is re-read against the new
 * view's defaults rather than carried over.
 *
 * The one thing it costs: `#the-four-ports?tools=1` is not an anchor the browser
 * scrolls to, because the fragment is no longer an element id. The site already
 * scrolls itself for in-site links (`router.tsx`), and `App.tsx` does the other
 * half on load.
 */
export interface ShellAddress {
  head: string;
  /** Whether the right panel is open. */
  tools: boolean;
  open: ReadonlySet<SectionId>;
  full: boolean;
  /** Everything this file does not understand, passed through untouched. */
  rest: URLSearchParams;
}

/** What a view is handed of the shell it is drawn inside. */
export interface ShellProps {
  address: ShellAddress;
  onAddress: (patch: Partial<ShellAddress>) => void;
  /** Wide enough for a docked panel beside the page, i.e. at least 64rem. */
  wide: boolean;
  /** The chrome is out of the way and this view has the window. */
  full: boolean;
}

/** The three names this file owns. Anything else in the hash belongs to the view. */
const OURS = ['tools', 'open', 'full'];

export function parseAddress(hash: string, view: ViewDeclaration): ShellAddress {
  const raw = hash.replace(/^#/, '');
  const cut = raw.indexOf('?');
  const head = cut === -1 ? raw : raw.slice(0, cut);
  const params = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));

  const rest = new URLSearchParams(params);
  for (const name of OURS) rest.delete(name);

  const asked = params.get('open');
  const declared = new Set(view.sections);

  return {
    // Not decoded. What is written back has to be byte-for-byte what the browser
    // reports, or `replaceHash` sees a difference every time and rewrites for
    // ever; `App.tsx` decodes at the one place it looks an element up by it.
    head,
    tools: view.sections.length > 0 && flag(params.get('tools'), view.panelOpenByDefault),
    // A section the view does not declare is dropped rather than refused: a link
    // written against another view should still open this one.
    open:
      asked === null
        ? new Set(view.openByDefault)
        : new Set(asked.split(',').filter((id): id is SectionId => declared.has(id as SectionId))),
    full: view.canGoFull && flag(params.get('full'), false),
    rest,
  };
}

/** `1` and a bare presence are on, `0` is off, absent is the view's default. */
function flag(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value !== '0';
}

export function writeAddress(address: ShellAddress, view: ViewDeclaration): string {
  const params = new URLSearchParams(address.rest);

  if (view.sections.length > 0 && address.tools !== view.panelOpenByDefault) {
    params.set('tools', address.tools ? '1' : '0');
  }
  // In the view's own order, so the same set of sections always writes the same
  // string and a link does not change because a panel was toggled twice.
  const open = view.sections.filter((id) => address.open.has(id));
  if (!sameSet(open, view.openByDefault)) params.set('open', open.join(','));
  if (view.canGoFull && address.full) params.set('full', '1');

  const query = params.toString();
  if (address.head === '' && query === '') return '';
  return `#${address.head}${query === '' ? '' : `?${query}`}`;
}

function sameSet(a: readonly SectionId[], b: readonly SectionId[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

const listeners = new Set<() => void>();

function readHash(): string {
  return window.location.hash;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
  };
}

/**
 * Writes the hash without a history entry, and tells React it moved.
 *
 * `replaceState` on purpose: toggling a panel is not a place to come back to,
 * and a back button that walked through six panel states would be a back button
 * nobody could use to leave the page. It also fires no `hashchange`, which is why
 * the listeners are called by hand here.
 */
function replaceHash(hash: string): void {
  const { pathname, search } = window.location;
  const next = hash === '' ? pathname + search : pathname + search + hash;
  if (window.location.hash === hash) return;
  window.history.replaceState(null, '', next);
  for (const listener of listeners) listener();
}

interface Held {
  kind: string;
  tools: boolean;
  open: ReadonlySet<SectionId>;
}

/**
 * The address of the open view, and the one way to change it.
 *
 * The panel state used to be a `useState` in `App.tsx` that forgot on every
 * navigation, except on `/preview`, where the shell wrote it to the hash. Now
 * every view does what the preview did, which is decision 6 of the redesign and
 * the reason this file exists at all.
 *
 * **A hash that says nothing does not shut the panel.** Following a link inside a
 * rendered document, or an entry in the contents, sets a bare `#the-four-ports`
 * with no `?` after it. Parsed against the defaults that would close a panel the
 * reader had opened, so what they last asked for is held here and put back with
 * `replaceState` — which does not scroll, and the browser has already scrolled on
 * the click, so the anchor still behaves like an anchor.
 */
export function useAddress(
  view: ViewDeclaration,
): [ShellAddress, (patch: Partial<ShellAddress>) => void] {
  const raw = useSyncExternalStore(subscribe, readHash, () => '');
  const held = useRef<Held | null>(null);

  const address = useMemo(() => {
    const parsed = parseAddress(raw, view);
    const kept = held.current;
    if (kept === null || kept.kind !== view.kind || raw.includes('?')) return parsed;
    return { ...parsed, tools: kept.tools, open: kept.open };
  }, [raw, view]);

  const current = useRef(address);
  current.current = address;

  /*
   * Put the held panel state back on a hash that lost it, and nothing else.
   *
   * **Only when the hash carries no `?` at all**, which is the one case this is
   * for: a click on `<a href="#the-four-ports">` inside a rendered document, or
   * on an entry in the contents. Anything else is the address already saying what
   * it means, and rewriting it here is not a no-op — it is a race the page loses.
   *
   * Measured on 2026-09-11, on `/preview` at 390px, by wrapping
   * `history.replaceState`: the page's own effects wrote `#/?d=iphone-15-pro` and
   * then `#/?d=iphone-15-pro&full=1`, and this effect — which runs after them,
   * because a parent's effects run after its children's — still held the FIRST
   * render's address, wrote the empty string for it and wiped both. The preview
   * then opened with its chrome on a phone, which is exactly what `full` at that
   * width exists to prevent, and nothing about it looked wrong.
   */
  useEffect(() => {
    // Somebody has written since this render parsed the hash, and what they wrote
    // stands: this effect holds a stale address and would undo them. The write
    // they made re-renders this hook, and it runs again on what they left.
    if (readHash() !== raw) return;
    if (raw.includes('?')) return;
    const wanted = writeAddress(address, view);
    if (wanted !== raw) replaceHash(wanted);
  }, [address, raw, view]);

  /**
   * A patch onto the address as it stands, and the ref is written back at once.
   *
   * **Two callers reach this within one tick and the second used to undo the
   * first.** `/preview` writes the frame's half whenever the frame moves, and a
   * reader collapsing a section writes the panel's half; a ref that only caught
   * up on the next render handed both of them the same stale address, so the
   * later write carried the earlier one's old value. Measured on 2026-09-11:
   * collapsing Console while the app was navigating left `open=` out of the URL
   * and the section visibly open. Writing the ref here makes a patch land on what
   * the last patch left, whether or not React has rendered in between.
   */
  const set = useCallback(
    (patch: Partial<ShellAddress>) => {
      const next = { ...current.current, ...patch };
      current.current = next;
      held.current = { kind: view.kind, tools: next.tools, open: next.open };
      replaceHash(writeAddress(next, view));
    },
    [view],
  );

  return [address, set];
}

/** The same set with one section added or taken away, for a toggle. */
export function toggled(open: ReadonlySet<SectionId>, id: SectionId): ReadonlySet<SectionId> {
  const next = new Set(open);
  if (!next.delete(id)) next.add(id);
  return next;
}
