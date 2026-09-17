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

let read: HomeLayout | null = null;

/**
 * The layout Home draws, read once.
 *
 * **Once is the whole point of the cache**, not the microseconds. ADR 0036 §7 wants an
 * unrecognised module reported, and a report made during render is made again on every
 * feed that lands, every pull to refresh and every theme change — which is a log nobody
 * can read and, once there is a provider behind the port (#95), a quota spent on one
 * typo. So the document is parsed on the first render and the answer is kept.
 *
 * It is lazy rather than module scope for one reason: `configurePlatform()` runs in
 * `app/_layout.tsx`, and a report made while this module is being imported would go to
 * the core's default reporter, which reports nowhere. By the first render the host's is
 * registered.
 *
 * `homeLayoutDocument` is the bundled one today, so the fallback below cannot fire yet.
 * It is the line §4 changes: when the app fetches a document, this is where the fetched
 * one arrives and `DEFAULT_HOME_LAYOUT` becomes what §10 promises, the copy in the
 * bundle that a first launch with no network gets.
 */
export function homeLayout(): HomeLayout {
  if (read) return read;
  const { layout, problems } = parseHomeLayout(homeLayoutDocument, RENDERABLE);
  reportLayoutProblems(problems);
  read = layout ?? DEFAULT_HOME_LAYOUT;
  return read;
}
