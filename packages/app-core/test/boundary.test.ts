import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The architectural guard.
 *
 * `@correctiv/app-core` only has value if it stays platform-free: it is what a
 * web target, a future native rewrite and this test suite all share. That
 * property is one careless import away from being lost, and nothing else in the
 * toolchain enforces it — so it is enforced here, in the same `npm run check`
 * that runs on every PR.
 *
 * If this test fails, the fix is never to widen the allow-list: move the code
 * that needs the SDK into a host (apps/mobile/src/lib/platform/…) and declare what
 * the core needs as a port in src/ports/index.ts.
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url));

const FORBIDDEN = [
  { pattern: /@nativescript\//, why: 'NativeScript SDK' },
  { pattern: /@nativescript-community\//, why: 'NativeScript community plugin' },
  { pattern: /@nstudio\//, why: 'NativeScript plugin' },
  { pattern: /^nativescript-vue$/, why: 'NativeScript Vue renderer' },
  { pattern: /^react-native/, why: 'React Native' },
  // The scoped half of the same ecosystem, which `^react-native` cannot see because
  // the package name starts with the scope. These are the ones a screen reaches for
  // first — storage, navigation, a faster list — and each would tie the core to a
  // host as firmly as `react-native` itself.
  {
    pattern: /^@react-native(-|\/)/,
    why: 'React Native, scoped (@react-native-async-storage/…, @react-native-community/…)',
  },
  { pattern: /^@react-navigation\//, why: 'React Navigation (a React Native navigator)' },
  { pattern: /^@shopify\/flash-list$/, why: 'FlashList (a React Native list)' },
  // The general form of the two above: anything called react-native-something under
  // somebody else's scope, so a package nobody has named yet is caught on arrival
  // rather than after it ships.
  { pattern: /^@[^/]+\/react-native(-|$)/, why: 'a React Native package under another scope' },
  { pattern: /^expo(-|$)/, why: 'Expo' },
  { pattern: /^@expo(-|\/)/, why: 'Expo, scoped (@expo/vector-icons, @expo-google-fonts/…)' },
  { pattern: /^node:/, why: 'Node built-in (the core runs on device and in a browser too)' },
  // The core was Pinia-based until the React Native pivot; these keep it from
  // drifting back. A UI framework in here would re-tie the core to one host, which
  // is exactly what moving the stores into the core avoided.
  //
  // State itself lives in Redux Toolkit (stores/store.ts), which is deliberately
  // NOT on this list: it is a state container, not a view layer, and it holds the
  // same property the hand-written store had — no UI framework, no platform SDK.
  // The binding stays the host's (react-redux in apps/mobile).
  { pattern: /^vue$|^@vue\//, why: 'Vue (hosts bind the store themselves)' },
  { pattern: /^pinia$/, why: 'Pinia (replaced by Redux Toolkit — see ADR 0004)' },
  { pattern: /^zustand/, why: 'zustand (the core is on Redux Toolkit)' },
  { pattern: /^react$|^react-dom$/, why: 'React (hosts bind the stores themselves)' },
];

/**
 * `.tsx` and `.jsx` are in the net even though the core holds neither, because a
 * file the walk skips is a file every assertion below passes over. The `no JSX`
 * test is what actually rejects one; this is what stops it being invisible first.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|jsx|ts|mts|mjs|js)$/.test(entry) && !entry.endsWith('.d.mts') ? [full] : [];
  });
}

/**
 * Every form in which a module name can enter a file. Three alternatives, in this
 * order, because the first that matches at a position wins and consumes the text:
 *
 *  1. `import 'react-native'` — a side-effect import, which has no `from` at all
 *     and is exactly how one pulls in a module for what it does to globals.
 *  2. `import('…')` and `require('…')` — the runtime forms. `require` matters even
 *     in an ESM package: a `.js` under `src` is read by whatever loads it, and it
 *     is the spelling a copied snippet arrives in.
 *  3. `import … from '…'` / `export … from '…'`, over as many lines as it takes.
 *
 * The lookbehind keeps `myImport(` and `foo.require(` out, and `[^;]*?` keeps the
 * third alternative inside one statement — without it a `from`-less `export { a };`
 * swallows the lines after it, side-effect imports included.
 */
const IMPORT_RE = new RegExp(
  [
    String.raw`(?<![\w$.])import\s*['"]([^'"]+)['"]`,
    String.raw`(?<![\w$.])(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)`,
    String.raw`(?<![\w$.])(?:import|export)[^;]*?\bfrom\s+['"]([^'"]+)['"]`,
  ].join('|'),
  'g',
);

/** The module name out of whichever alternative of IMPORT_RE matched. */
function specifier(match: RegExpMatchArray): string | undefined {
  return match[1] ?? match[2] ?? match[3];
}

describe('core stays platform-free', () => {
  const files = sourceFiles(SRC);

  it('finds source files to check (guards against a silently empty scan)', () => {
    expect(files.length).toBeGreaterThan(25);
  });

  /**
   * The second net, and the one that can go quiet without anything looking wrong:
   * every assertion below reads the core through IMPORT_RE, so a regex that stopped
   * matching would report a core with no imports at all and pass. The fixture names
   * one specifier per form, so a form that falls out of the net fails here by name
   * rather than by letting a real import through somewhere else.
   */
  it('matches every import form it claims to (guards against a net that catches nothing)', () => {
    const fixture = [
      "import { a } from 'named-import';",
      "import Default from 'default-import';",
      "import type { B } from 'type-only-import';",
      "import 'side-effect-import';",
      "export { c } from 'named-reexport';",
      "export * from 'star-reexport';",
      "const d = await import('dynamic-import');",
      "const e = require('commonjs-require');",
      "import {\n  f,\n} from 'multi-line-import';",
      'export { g };',
      "import 'after-a-from-less-export';",
    ].join('\n');

    expect([...fixture.matchAll(IMPORT_RE)].map((m) => specifier(m)).sort()).toEqual([
      'after-a-from-less-export',
      'commonjs-require',
      'default-import',
      'dynamic-import',
      'multi-line-import',
      'named-import',
      'named-reexport',
      'side-effect-import',
      'star-reexport',
      'type-only-import',
    ]);

    // And that it still finds them in the real thing, not only in the fixture.
    const found = files.flatMap((full) => [...readFileSync(full, 'utf8').matchAll(IMPORT_RE)]);
    expect(found.length).toBeGreaterThan(50);
  });

  it('holds no JSX file (guards against a view layer the imports cannot show)', () => {
    // A `.tsx` in the core is the violation, before anything it imports is read:
    // JSX compiles to a call into a view layer that the compiler injects
    // (`react/jsx-runtime`), so it never appears as an import and no pattern in
    // FORBIDDEN can see it. The extension is the whole of the evidence, which is
    // why this is its own assertion and not another line in the list above.
    const jsx = files.filter((full) => /\.[jt]sx$/.test(full));
    expect(jsx.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))(
    '%s imports no platform SDK',
    (_name, full) => {
      const source = readFileSync(full, 'utf8');
      const offenders: string[] = [];

      for (const match of source.matchAll(IMPORT_RE)) {
        const spec = specifier(match);
        if (!spec || spec.startsWith('.')) continue;
        const hit = FORBIDDEN.find((f) => f.pattern.test(spec));
        if (hit) offenders.push(`${spec} (${hit.why})`);
      }

      expect(offenders).toEqual([]);
    },
  );

  it('routes every platform capability through a declared port', () => {
    // Anything the core needs from its host must appear in ports/index.ts — one
    // file to read to know what implementing a new host costs.
    const ports = readFileSync(join(SRC, 'ports/index.ts'), 'utf8');
    for (const port of [
      'KeyValueStore',
      'BlobStore',
      'ContentBundle',
      'AudioBackend',
      'ErrorReporter',
    ]) {
      expect(ports).toMatch(new RegExp(`export interface ${port}`));
    }
    expect(ports).toMatch(/export interface CorePlatform/);
  });

  /**
   * The DOM extraction backend is the one place in the core that has runtime
   * dependencies, and it exists so a host without an HTML parser does not need one.
   * Nothing outside it may import it. An accidental import somewhere central would
   * pull htmlparser2 into a bundle whose resolver cannot handle it, and that failure
   * shows up on a device, not here.
   */
  it('keeps the HTML parser inside the DOM extraction backend', () => {
    const parserImports = files.filter((full) => {
      if (full.endsWith(join('articles', 'extract', 'dom.ts'))) return false;
      return /from '(?:htmlparser2|css-select|domutils|dom-serializer|domhandler)'/.test(
        readFileSync(full, 'utf8'),
      );
    });
    expect(parserImports.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
