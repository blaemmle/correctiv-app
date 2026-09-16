#!/usr/bin/env node
/**
 * Produces src/gallery/components.generated.ts: the union of every component
 * address `src/components` actually contains.
 *
 * ## Why this exists rather than a test
 *
 * "Every component has a catalogue entry" used to be a source-reading test with a
 * list of exceptions — the weakest of ADR 0031's four mechanisms, and the one it
 * names as standing a rung too low. TypeScript cannot read a directory, so the
 * set the catalogue must cover is not a union anybody typed. This script is the
 * half that makes it one; `src/gallery/catalogue.tsx` is the half that spends it.
 * Forgetting a component is then a compile error, and forgetting to run this is a
 * red test (`__tests__/gallery-catalogue.test.ts`, the drift check).
 *
 * ## Why the walk is exported
 *
 * The test still has to read `src/components` for the three facts no type can see
 * — one component per file, named after its file; nothing hiding in a `.ts`; the
 * directory is not silently empty. Two walks with two ideas of what a component
 * is would be two answers, so there is one walk and the test imports it.
 *
 * Run: npm run component-ids
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** How the emitted file names itself, so a reader of the artefact lands here. */
const SCRIPT = 'scripts/generate-component-ids.mjs';
/** The one spelling of the command, printed in the artefact's header. */
const COMMAND = 'npm run component-ids';

/** This package, by its own name, so nothing above the repo can answer instead. */
const APP_PKG_NAME = '@correctiv/mobile';

/**
 * Where this app is, found rather than counted in `..`s.
 *
 * This module is loaded two ways: as real ESM by `npm run component-ids`, and
 * transpiled to CommonJS by babel-jest for the drift check. Under the latter
 * `import.meta.url` is **null**, so using it unguarded throws before any test can
 * run — `scripts/tokens-source.mjs` carries the same note and learned it the same
 * way. The fallback is the working directory, which is inside this package for
 * jest (cwd = rootDir) and inside the repo for a `node` invocation from anywhere.
 *
 * @returns {string}
 */
function findAppRoot() {
  const self = typeof import.meta?.url === 'string' ? import.meta.url : null;
  const from = self ? resolve(dirname(fileURLToPath(self)), '..') : process.cwd();
  for (let dir = from; ; dir = dirname(dir)) {
    const pkg = join(dir, 'package.json');
    try {
      if (JSON.parse(readFileSync(pkg, 'utf8')).name === APP_PKG_NAME) return dir;
    } catch {
      // No package.json here, or an unreadable one — not this app, keep walking.
    }
    if (dirname(dir) === dir) {
      throw new Error(`${SCRIPT}: no ${APP_PKG_NAME} package.json at or above ${from}`);
    }
  }
}

const APP = findAppRoot();
const COMPONENTS = resolve(APP, 'src/components');
const OUT = resolve(APP, 'src/gallery/components.generated.ts');

/**
 * **What counts as a component**: a PascalCase value exported from a `.tsx` file
 * under `src/components`, addressed as `folder/Name`.
 *
 * Three lines drawn, each for a reason that can be checked rather than argued:
 *
 *  - **The export, not the file.** `VideoFrame.web.tsx` exports `VideoFrame`,
 *    because the suffix is Metro's and not the caller's, so a platform split
 *    collapses to one address without a suffix rule — which is what the gallery
 *    needs, since it draws whichever half the bundler kept and cannot say which.
 *    Both halves therefore produce the same address and the union holds it once.
 *  - **`.tsx`, not `.ts`.** JSX in a `.ts` file is a typecheck error, so a `.ts`
 *    file under this folder renders nothing — the barrel and the shared prop
 *    types (`reader/types.ts`, `media/videoFrameTypes.ts`,
 *    `ui/screenHeaderTypes.ts`) are excluded by the extension and need no
 *    exception of their own. The test's `hides no component in a .ts file` keeps
 *    the extension a rule rather than an assumption.
 *  - **PascalCase, and it must contain a lower-case letter.** `sampleTarget` is
 *    callable and lower case; `HEADER_COPY` and `READER_BASE_URL` are capitalised
 *    and are not components. `apps/handbook/scripts/api.mjs` draws the same line
 *    with a real type graph — "a capitalised callable", `componentSignature` —
 *    and it is the same line for the same reason: nothing under `src/components`
 *    is both callable and capitalised except a component. This reads spelling
 *    instead of callability, so it errs towards noticing: a PascalCase export
 *    that is not a component has to be catalogued or excused, and that is a
 *    conversation rather than a silence.
 */
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const EXPORTED_VALUE = /^export (?:function|const) (\w+)/gm;

/**
 * A source file with its comments taken out, and its line numbering intact.
 *
 * The same two expressions as `packages/app-core/test/support/source.ts`, which
 * this cannot import: that file is TypeScript and this is a `.mjs` the app's
 * Metro build never sees. The limit written down there is inherited here — a pair
 * of regular expressions cannot tell a `//` inside a string literal from one that
 * opens a comment, so an `export const Name` written after one on the same line
 * is invisible to this walk and therefore absent from the union.
 *
 * @param {string} source
 * @returns {string}
 */
function withoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

/**
 * Every file under a directory, at any depth.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function filesUnder(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

/**
 * Every file under `src/components`, as a path with `/` on every OS.
 *
 * @returns {string[]}
 */
export function componentFiles() {
  return filesUnder(COMPONENTS).map((path) => relative(COMPONENTS, path).split(sep).join('/'));
}

/**
 * The PascalCase values a file exports, comments taken out first.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function exportedComponents(source) {
  return [...withoutComments(source).matchAll(EXPORTED_VALUE)]
    .map(([, name]) => name)
    .filter((name) => PASCAL_CASE.test(name) && /[a-z]/.test(name));
}

/**
 * @typedef {object} Declared
 * @property {string} id `folder/Name`: the app's own address, and `?c=` on both sites.
 * @property {string} file Path under `src/components`, so a failure names a file to open.
 * @property {string} name
 */

/**
 * Every component under `src/components`, one record per export.
 *
 * Not deduplicated: `ReaderView.tsx` and `ReaderView.web.tsx` are two files with
 * one address, and the test's per-file assertions need both of them. The union
 * below is what folds them together.
 *
 * @returns {Declared[]}
 */
export function declaredComponents() {
  return componentFiles()
    .filter((file) => file.endsWith('.tsx'))
    .flatMap((file) => {
      // A file directly under `src/components` has no folder over it. There is
      // none today; one added tomorrow gets the address `components/Name` here
      // and in the handbook's reference, which uses the same fallback.
      const folder = file.includes('/') ? file.slice(0, file.indexOf('/')) : 'components';
      return exportedComponents(readFileSync(join(COMPONENTS, file), 'utf8')).map((name) => ({
        id: `${folder}/${name}`,
        file,
        name,
      }));
    });
}

/**
 * Every address, once, in a fixed order.
 *
 * Sorted rather than written in walk order, because the walk order is the
 * filesystem's and an artefact that changes when a directory is re-created is an
 * artefact that drifts for nothing.
 *
 * @returns {string[]}
 */
export function componentIds() {
  return [...new Set(declaredComponents().map(({ id }) => id))].sort();
}

/**
 * The artefact's text, which is what the drift check compares against.
 *
 * Separated from writing it so that check needs neither a subprocess nor a write:
 * `packages/design-tokens/test/drift.test.ts` has to run its generator and put
 * the bytes back afterwards, because that generator has no seam between deciding
 * and writing. This one does, and the write path below is the same string.
 *
 * @returns {string}
 */
export function render() {
  const ids = componentIds();
  if (ids.length === 0) {
    // A resolution fault or a moved directory would otherwise emit `never`, and
    // `never` satisfies every check the catalogue makes of this union.
    throw new Error(`${SCRIPT}: found no component under ${COMPONENTS}`);
  }
  return `// AUTO-GENERATED by ${SCRIPT} — do not edit by hand.
// Source: src/components/**/*.tsx · Regenerate: ${COMMAND}

/**
 * Every component \`src/components\` contains, addressed \`folder/Name\`.
 *
 * The address is the app's own and is the same string on both sides of the seam:
 * the gallery's entry, the handbook's reference row, and \`?c=\` between the two
 * sites. The platform suffix is deliberately not part of it — \`ReaderView.tsx\`
 * and \`ReaderView.web.tsx\` are one member here.
 *
 * \`src/gallery/catalogue.tsx\` is typed against this union, so a component added
 * to \`src/components\` stops the app compiling until it has an entry or a written
 * reason not to have one.
 */
export type ComponentId =
${ids.map((id) => `  | '${id}'`).join('\n')};
`;
}

function main() {
  writeFileSync(OUT, render());
  console.log(`${relative(APP, OUT)}: ${componentIds().length} components`);
}

/**
 * Nothing runs when a test imports the walk above, and nothing runs under
 * babel-jest either: `import.meta.url` is null there, which is the same fact
 * `findAppRoot` is written around and would throw here if it were read unguarded.
 */
const self = typeof import.meta?.url === 'string' ? import.meta.url : null;
if (self && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(self)) main();
