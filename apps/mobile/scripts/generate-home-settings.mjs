#!/usr/bin/env node
/**
 * Produces packages/app-core/src/lib/home-settings.generated.ts: the table of settings
 * the core's parser validates a document against, written from the declarations that
 * sit beside the modules in this app.
 *
 * ## Why this exists rather than one table somebody keeps in both places
 *
 * [ADR 0045](../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §9. A
 * module and its settings were two halves in two packages, and the failure when they
 * parted was quiet: a spec no module reads does nothing, and a module reading a key the
 * table does not list gets its fallback forever, because the parser refuses the key and
 * drops it. The declaration is now written where the module is written
 * (`src/lib/home/settings.ts`), and this script is what carries it into the core.
 *
 * It cannot be an import. `@correctiv/app-core` is a dependency of this app, so an import
 * back into the app is a cycle and the end of the core being a package that stands on its
 * own ([ADR 0006](../../../adr/0006-one-core-two-hosts.md)). And the core cannot be
 * handed the table at startup instead: `parseHomeLayout(document)` would then answer
 * differently depending on what had booted first, which is the platform freedom
 * everything hangs on, spent to save a script.
 *
 * A generator crosses that boundary without reversing it. The dependency at build time is
 * a script reading a file; the dependency at compile time and at runtime stays what it
 * was, and what is committed is a file in the core with no import from this app in it.
 *
 * Forgetting to run this is a red test — `__tests__/home-settings.test.ts`, the drift
 * check — which is ADR 0031's mechanism 2 and the same deal
 * `scripts/generate-component-ids.mjs` already charges: a compile error or a red check,
 * and a one-line fix.
 *
 * ## Why it imports the declarations rather than reading their text
 *
 * `generate-component-ids.mjs` reads source with regular expressions because what it
 * wants is the set of NAMES a folder exports, and no import can give it that. This one
 * wants the VALUES, nested two deep, and a pair of expressions over a TypeScript object
 * literal is the kind of parser that works until somebody writes a trailing comment
 * inside it. Node strips the types and hands over the real objects, so what is emitted is
 * what the app actually holds.
 *
 * That is also the constraint on the declaration file: it may import types and nothing
 * else, because an ordinary import would be a module Node has to resolve at a path it has
 * no resolver for. Its own docblock says so where somebody editing it will read it.
 *
 * Run: npm run home-settings
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** How the emitted file names itself, so a reader of the artefact lands here. */
const SCRIPT = 'apps/mobile/scripts/generate-home-settings.mjs';
/** The one spelling of the command, printed in the artefact's header. */
const COMMAND = 'npm run home-settings';

/** This package, by its own name, so nothing above the repo can answer instead. */
const APP_PKG_NAME = '@correctiv/mobile';

/**
 * Where this app is, found rather than counted in `..`s.
 *
 * The same walk `generate-component-ids.mjs` does, and for the same reason: this module
 * is loaded two ways, as real ESM by `npm run home-settings` and transpiled to CommonJS
 * by babel-jest for the drift check. Under the latter `import.meta.url` is **null**, so
 * reading it unguarded throws before any test can run.
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
/** The declarations, as a path rather than a specifier, because it is a `.ts` file. */
const DECLARATIONS = resolve(APP, 'src/lib/home/settings.ts');
const OUT = resolve(APP, '../../packages/app-core/src/lib/home-settings.generated.ts');

/**
 * Where the declarations are, spelled from the repository root for the artefact's header
 * and for a failure message, so both name a file somebody can open.
 */
const DECLARATIONS_LABEL = 'apps/mobile/src/lib/home/settings.ts';

/**
 * One setting, serialised with its fields named rather than run through
 * `JSON.stringify`.
 *
 * Two things that buys, and both were worth the twenty lines. A kind this script has
 * never heard of **throws** here instead of being emitted as whatever shape it happened
 * to have — the core's `SettingSpec` union would then reject the artefact and the error
 * would name a generated file rather than the declaration that caused it. And the field
 * order is this file's rather than the declaration's, so re-ordering the keys of a
 * literal in the app does not rewrite the artefact.
 *
 * @param {import('@correctiv/app-core/lib/home-settings').SettingSpec} spec
 * @returns {string}
 */
function renderSpec(spec) {
  if (spec.kind === 'article') {
    return `{ key: '${spec.key}', kind: 'article', fallback: null }`;
  }
  if (spec.kind === 'count') {
    return (
      `{ key: '${spec.key}', kind: 'count', ` +
      `min: ${spec.min}, max: ${spec.max}, fallback: ${spec.fallback} }`
    );
  }
  throw new Error(
    `${SCRIPT}: ${DECLARATIONS_LABEL} declares a setting of kind ` +
      `'${/** @type {{ kind: string }} */ (spec).kind}', which this script cannot write. ` +
      `Add it to \`renderSpec\` here and to \`SettingSpec\` in the core together.`,
  );
}

/**
 * The artefact's text, which is what the drift check compares against.
 *
 * Takes the table rather than importing it, so the check needs neither a subprocess nor a
 * write, and so the one thing under test is the rendering. The module order is the
 * declaration's own, because that is the order somebody reading the app's file sees and
 * an alphabetical artefact would answer a question nobody asked; what is sorted is
 * nothing, and what makes it deterministic is that a JavaScript object keeps its string
 * keys in insertion order.
 *
 * @param {Readonly<Record<string, readonly import('@correctiv/app-core/lib/home-settings').SettingSpec[]>>} table
 * @returns {string}
 */
export function render(table) {
  const modules = Object.entries(table);
  if (modules.length === 0) {
    // An empty table validates every document: the parser reads `MODULE_SETTINGS[module]
    // ?? []` and refuses every key, so every configured place in the shipped document
    // would be refused at once. A resolution fault must not be able to write that.
    throw new Error(`${SCRIPT}: ${DECLARATIONS_LABEL} declares no module with settings`);
  }
  const rows = modules.map(
    ([module, specs]) => `  '${module}': [${specs.map(renderSpec).join(', ')}],`,
  );
  return `// AUTO-GENERATED by ${SCRIPT} — do not edit by hand.
// Source: ${DECLARATIONS_LABEL} · Regenerate: ${COMMAND}

import type { SettingSpec } from './home-settings';

/**
 * Module name, as the document writes it, to the settings it understands.
 *
 * The declarations live beside the modules that read them, in \`${DECLARATIONS_LABEL}\`,
 * and this file is what carries them across the boundary the other direction cannot be
 * crossed in — the core is a dependency of the app, so the app cannot be a dependency of
 * the core. ADR 0045 §9 is the record; the script named above is the mechanism.
 *
 * Nothing here imports the app, which is the point: \`parseHomeLayout\` answers the same
 * way in a test, in a check, in the configurator and in the app, with nothing booted
 * first.
 */
export const MODULE_SETTINGS: Readonly<Record<string, readonly SettingSpec[]>> = {
${rows.join('\n')}
};
`;
}

/**
 * The declarations, as the app holds them.
 *
 * A URL rather than a specifier so Node reads the `.ts` file by path and strips its
 * types; a specifier would send it looking for a package. It is also why this is not at
 * the top of the file: the drift check imports `render` under babel-jest, where this
 * import would be transpiled into a `require` of a TypeScript file.
 *
 * @returns {Promise<Readonly<Record<string, readonly import('@correctiv/app-core/lib/home-settings').SettingSpec[]>>>}
 */
async function declarations() {
  const module = await import(pathToFileURL(DECLARATIONS).href);
  return module.HOME_MODULE_SETTINGS;
}

async function main() {
  const table = await declarations();
  writeFileSync(OUT, render(table));
  const settings = Object.values(table).reduce((total, specs) => total + specs.length, 0);
  console.log(
    `${relative(resolve(APP, '../..'), OUT)}: ` +
      `${settings} settings over ${Object.keys(table).length} modules`,
  );
}

/**
 * Nothing runs when the drift check imports `render` above, and nothing runs under
 * babel-jest either: `import.meta.url` is null there, which is the same fact
 * `findAppRoot` is written around and would throw here if it were read unguarded.
 *
 * Called rather than awaited, because `await` at the top level is a syntax babel-jest
 * cannot transpile into the CommonJS it hands jest — the guard above would never let it
 * run, and the file would still fail to load. So the rejection is caught by hand instead.
 */
const self = typeof import.meta?.url === 'string' ? import.meta.url : null;
if (self && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(self)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
