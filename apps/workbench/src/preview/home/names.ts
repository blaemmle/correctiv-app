/**
 * The two names the editor's two ends have to spell the same way.
 *
 * A leaf with no imports at all, and that is the whole reason it is a file. Vite loads
 * `vite.config.ts` with Node, and Node refuses the core's `home.layout.json` without an
 * import attribute — so a dev-server plugin cannot reach a module that imports the core,
 * and both of these are needed before a request can even be matched. Everything else the
 * endpoint needs is loaded through Vite's own pipeline when a request arrives, which is
 * what `plugin/home-layout.ts` does and says.
 *
 * `document.ts` re-exports both, so nothing in the browser has to know this file exists.
 */

/**
 * Where the app looks for a document somebody else wrote.
 *
 * The same string as `HOME_LAYOUT_OVERRIDE_KEY` in
 * `apps/mobile/src/lib/home/layout.ts`, and the app's file is where the argument for it
 * lives. Two spellings of one key is the failure ADR 0014 warns about for cross-origin,
 * reached by a different door: every edit would still "succeed", the app would go on
 * drawing the compiled-in document, and nothing anywhere would say why.
 * `test/preview/home-document.test.ts` holds the two together.
 */
export const HOME_LAYOUT_KEY = 'workbench:home-layout';

/**
 * The endpoint `plugin/home-layout.ts` answers on, in development and nowhere else.
 *
 * `__workbench` is a prefix no route, no document and no proxy rule in `vite.config.ts`
 * uses, which is what keeps it from being shadowed by the app on `/app` or by a document
 * whose slug somebody adds later.
 */
export const HOME_LAYOUT_ENDPOINT = '/__workbench/home-layout';
