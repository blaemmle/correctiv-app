import { parseHomeLayout, type HomeLayout } from '@correctiv/app-core/lib/home-layout';

import {
  changed,
  formatLayoutDocument,
  HOME_LAYOUT_ENDPOINT,
  HOME_LAYOUT_KEY,
  SHIPPED,
} from './document';

/**
 * The two ways a change leaves the page: into the running app, and into the repository.
 *
 * Split from `document.ts` because that file is imported by the dev server and this one
 * cannot be: `import.meta.env` is Vite's, `window` is the browser's, and either of them
 * evaluated while Vite loads its own config is a site that does not start. Everything
 * here touches one or the other.
 */

/**
 * Put the edited document where the framed app will find it, or take it away again.
 *
 * The shell and the app are one origin, so `window.localStorage` here **is** the app's,
 * which is the whole mechanism `frame/seed.ts` already runs on. What is new is that the
 * app redraws without a reload: a write to `localStorage` fires a `storage` event in
 * every other same-origin document, the frame is one, and the app subscribes. No dev
 * handle, so this works against the published export too.
 *
 * A layout equal to the shipped one **removes** the key rather than writing a copy of
 * it. `/preview` with nothing edited must leave the app exactly as it ships, and a key
 * that is written once and then matches for ever is a state nobody can see and nobody
 * clears.
 */
export function publish(layout: HomeLayout): void {
  try {
    if (changed(layout).length === 0) window.localStorage.removeItem(HOME_LAYOUT_KEY);
    else window.localStorage.setItem(HOME_LAYOUT_KEY, formatLayoutDocument(layout));
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}

/**
 * What was left in storage by an earlier visit, so the tool opens on what the app draws.
 *
 * Anything the core will not take cleanly is discarded rather than loaded for repair:
 * the editor's vocabulary cannot express a broken document, so opening on one would give
 * a person a list they can move around and never make valid.
 */
export function restore(): HomeLayout {
  try {
    const raw = window.localStorage.getItem(HOME_LAYOUT_KEY);
    if (raw === null) return SHIPPED;
    const { layout, problems } = parseHomeLayout(JSON.parse(raw));
    return layout && problems.length === 0 ? layout : SHIPPED;
  } catch {
    return SHIPPED;
  }
}

export interface SaveResult {
  ok: boolean;
  /** What to show the person: the file that was written, or why it was not. */
  message: string;
}

/**
 * Whether Save is on offer at all.
 *
 * `import.meta.env.DEV` is the honest test and not a probe: `vite build` sets it false,
 * so the published site cannot reach a server that would answer, and the interface says
 * so beside the button rather than letting somebody find out by pressing it. That is the
 * shape the Tokens tool already has for a thing it cannot write — "Nothing is written to
 * the repository; Copy CSS is how a proposal leaves this page."
 */
export const canSave: boolean = import.meta.env.DEV;

/**
 * Write the document into the repository, which only the dev server can do.
 *
 * The body is already `formatLayoutDocument`'s output, and the endpoint prints it again
 * from its own parse rather than trusting it. Both are the same function; the second
 * call is what makes the file on disk formatted whatever reached the socket.
 */
export async function save(layout: HomeLayout): Promise<SaveResult> {
  try {
    const response = await fetch(HOME_LAYOUT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: formatLayoutDocument(layout),
    });
    const body = (await response.json()) as {
      path?: string;
      error?: string;
      problems?: { code: string }[];
    };
    if (!response.ok) {
      // The codes, not only the sentence. `LayoutProblemCode` is the vocabulary the core
      // reports a fault in, and a person looking at a refusal wants the one that fired,
      // not a second English gloss on it.
      const codes = (body.problems ?? []).map((problem) => problem.code).join(', ');
      const said = body.error ?? `HTTP ${response.status}`;
      return { ok: false, message: codes ? `${said} (${codes})` : said };
    }
    return { ok: true, message: `Written to ${body.path ?? 'the repository'}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
