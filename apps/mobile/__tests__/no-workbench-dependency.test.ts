import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { IMPORT_RE, specifier, withoutComments } from './support/source';

/**
 * ADR 0040, the configuration half.
 *
 * **The rule is one direction and it is not symmetric.** `apps/workbench` may read
 * `apps/mobile`, and does: it compiles the app's components for `/components`, it
 * holds its own provider list against `AppEnvironment.tsx`, it writes the
 * `workbench:` override keys the app declares, and it frames the app's own web
 * export. None of that is a violation and none of it is what this file looks for.
 * What it looks for is the other direction: `apps/mobile` or a package it ships
 * reaching into the workbench.
 *
 * **Why the direction is worth a check.** The app ships, to a phone, through a
 * store. The workbench is a developer tool on a public URL with no access control.
 * A dependency from the app to the workbench puts a tool inside a release bundle,
 * and ADR 0026 §1 measured how quietly that happens: three of five ways of writing
 * a guarded `require()` leaked a devtool's export names into a production export
 * while every one of them looked guarded in the source.
 *
 * **Why this half exists at all, given the other one.** The backstop is
 * ci.yml's `independence` job: it moves `apps/workbench` out of the tree for real,
 * re-installs, and asks the app's own toolchain. That is the stronger half, because
 * it asks the toolchain rather than a regular expression. It cannot see the shapes
 * that go GREEN when the directory is gone, and there are several: a Tailwind
 * `@source`, a jest `moduleNameMapper`, a Metro `watchFolders` entry and a `paths`
 * alias all MATCH NOTHING and build. What comes out is an app missing whatever that
 * entry was contributing. `src/global.css` records this happening from the other
 * side: a stylesheet built green while dozens of the app's utilities were missing,
 * so every row in every drawn component stood on end. A dependency entry in
 * `package.json` with no import behind it yet is the same shape.
 *
 * And one more the record did not name, measured on 2026-09-17 by writing all three
 * and exporting with the directory gone: a **named import of the workbench whose
 * binding nothing reads** exports fine. The transform elides it, so it never enters
 * the graph and Metro never resolves it. A side-effect import and a used binding both
 * fail the export, loudly. So the line between the two halves is not "source versus
 * toolchain"; the import that is about to matter is on this side of it. (Writing that
 * example out as real code is what the import net below caught next, in this comment,
 * which is the second time this file has proved itself by failing.)
 *
 * **What this cannot see**, per ADR 0031's obligation on a mechanism-4 check, and
 * written here rather than in a document because this is where somebody reaching
 * for a bypass is looking:
 *
 *  - **A path assembled at runtime.** `join(workspaceRoot, 'apps', 'workbench')` is
 *    two string literals and neither is a match. So is `require(name)` where `name`
 *    is a variable. The build half is what stands behind this.
 *  - **A configuration file nobody has written yet.** The named list below is what
 *    the app's toolchain reads TODAY. A new one is picked up automatically only if
 *    it sits at the root of one of the scanned workspaces; anywhere else it is
 *    invisible until somebody adds a line. Again: the build half.
 *  - **A server.** ADR 0040 §4 records "no app server unless agreed otherwise" as
 *    the one way to invert the direction without writing an import: the app fetching
 *    a document the workbench operates is a dependency with no import, no path and
 *    no manifest entry to read. Nothing here or in the build half can see it, and
 *    inventing a check that could not tell that URL from correctiv.org's REST API
 *    would be a check that cannot fail. It stays a decision with a record.
 *  - **`tools/`.** Out of scope on purpose: ADR 0040 §2 names `apps/mobile` and
 *    `packages/`, and `tools/figma-plugin` ships with neither.
 */

/** The repository root, three levels up from `apps/mobile/__tests__`. */
const REPO = resolve(__dirname, '../../..');

/** A path as this file talks about it: relative to the repository, forward slashes. */
const rel = (full: string): string => relative(REPO, full).split(sep).join('/');

/**
 * Every spelling that reaches the workbench, and what each one is the shape of.
 *
 * Three rather than one because they are three different mistakes and the failure
 * message should say which. The `workbench:` override keys the app declares —
 * `workbench:seeded`, `workbench:home-layout`, `workbench:home-time` — match none
 * of them, and that is deliberate: ADR 0040 §3 is that a shared spelling is not a
 * dependency. The app may declare a seam the workbench uses; it may not read the
 * workbench to know what to declare.
 */
const REACHES = [
  {
    name: '@correctiv/workbench',
    pattern: /@correctiv\/workbench/,
    why: "the workbench's package name: an import, a dependency entry, a `paths` alias, or `-w @correctiv/workbench` in a script",
  },
  {
    name: 'apps/workbench',
    pattern: /apps\/workbench/,
    why: 'the workbench directory named from the repository root: a tsconfig path, a Metro watch folder, a jest root, a Tailwind `@source`',
  },
  {
    name: '../workbench',
    pattern: /(?:\.\.\/)+workbench(?![\w:-])/,
    why: 'the workbench directory reached relatively, which is the spelling an import inside `apps/` writes',
  },
];

/** Which of the three a piece of text reaches by, if any. */
function reachesIn(text: string): typeof REACHES {
  return REACHES.filter((reach) => reach.pattern.test(text));
}

/**
 * The files the app's toolchain reads, each with the reason it is on the list.
 *
 * ADR 0031's first obligation on a mechanism-4 check: an exception carries its
 * reason, and so does an entry — a list of bare paths says nothing about which of
 * them could go and which could not. Every one of these is asserted to EXIST, so a
 * config file renamed or moved fails here rather than dropping silently off the
 * scan, which is the way a list like this normally stops working.
 *
 * The workspaces' package roots are scanned wholesale on top of this (see
 * `configurationFiles`), so a new config file beside one of these is in the net
 * from the day it is written. This list is what makes a DISAPPEARANCE red.
 */
const TOOLCHAIN: { path: string; why: string }[] = [
  {
    path: 'apps/mobile/package.json',
    why: "the app's manifest: its dependencies, and every script npm will run for it",
  },
  {
    path: 'apps/mobile/tsconfig.json',
    why: '`paths`, `include` and `extends`; jest-expo derives its own moduleNameMapper from `paths`, so an alias here reaches the suite too',
  },
  { path: 'apps/mobile/tsconfig.test.json', why: "the suite's program and its ambient files" },
  { path: 'apps/mobile/tsconfig.scripts.json', why: "the generators' program" },
  {
    path: 'apps/mobile/metro.config.js',
    why: '`watchFolders`, `nodeModulesPaths` and `resolveRequest`: what the bundler may read and how it resolves',
  },
  {
    path: 'apps/mobile/jest.config.js',
    why: '`moduleNameMapper`, `setupFiles`, `transformIgnorePatterns`',
  },
  { path: 'apps/mobile/babel.config.js', why: 'presets and plugins, which resolve as modules' },
  {
    path: 'apps/mobile/app.json',
    why: "Expo's configuration: plugins and asset paths, which prebuild copies into the native projects",
  },
  { path: 'apps/mobile/app.config.js', why: 'the dynamic half of the same configuration' },
  { path: 'apps/mobile/index.js', why: 'the entry point Metro starts from' },
  {
    path: 'apps/mobile/src/global.css',
    why: "Tailwind's `@source` and `@import`; the entry on this list whose violation would build green while the app lost utilities",
  },
  {
    path: 'apps/mobile/assets.d.ts',
    why: 'an ambient declaration file, which can `declare module` at any path',
  },
  { path: 'apps/mobile/uniwind-types.d.ts', why: 'the same' },
  { path: 'packages/app-core/package.json', why: "the core's manifest" },
  { path: 'packages/app-core/tsconfig.json', why: "the core's program" },
  { path: 'packages/app-core/vitest.config.ts', why: "the core's suite" },
  { path: 'packages/design-tokens/package.json', why: "the token package's manifest" },
  { path: 'packages/design-tokens/tsconfig.json', why: "the token package's program" },
];

/**
 * The workspaces whose toolchain must not be able to see the workbench: the app,
 * and every package it may ship. `packages/` is read rather than listed, so a
 * package added tomorrow is in the net without anybody remembering this file.
 */
function scannedWorkspaces(): string[] {
  const packages = readdirSync(join(REPO, 'packages'))
    .map((entry) => join(REPO, 'packages', entry))
    .filter((full) => statSync(full).isDirectory());
  return [join(REPO, 'apps/mobile'), ...packages];
}

/** Text files worth reading: source, configuration, stylesheets, data. */
const READABLE = /\.(tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/;

/** Everything at the root of a scanned workspace, plus the named list above. */
function configurationFiles(): string[] {
  const roots = scannedWorkspaces().flatMap((root) =>
    readdirSync(root)
      .map((entry) => join(root, entry))
      .filter((full) => statSync(full).isFile() && READABLE.test(full)),
  );
  const named = TOOLCHAIN.map((entry) => join(REPO, entry.path)).filter((full) => existsSync(full));
  return [...new Set([...roots, ...named])].sort();
}

/** The trees under a workspace that hold code rather than build output. */
const SOURCE_TREES = ['src', 'scripts', 'test', '__tests__'];

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return READABLE.test(entry) ? [full] : [];
  });
}

function sourceFiles(): string[] {
  return scannedWorkspaces()
    .flatMap((root) => SOURCE_TREES.map((tree) => join(root, tree)))
    .flatMap(filesUnder)
    .sort();
}

/**
 * This file, and the one thing that excuses it.
 *
 * It has to write the three spellings down in order to look for them, so the text
 * net below would find itself. The import net does NOT excuse it, which is the
 * half that matters: this file importing the workbench is still red.
 */
const THIS_FILE = 'apps/mobile/__tests__/no-workbench-dependency.test.ts';

/**
 * The one file that names the workbench outside a comment, and why that is not a
 * dependency.
 *
 * ADR 0031: an exception carries its reason. `generate-component-ids.mjs` writes
 * prose for a file it generates, and the prose says that a component's address is
 * spelled in three places and that they move together. One of the three is
 * `apps/workbench/scripts/api.mjs`. That sentence is a comment in every sense
 * except that the generator carries it as a template literal, which is the one
 * thing `withoutComments` cannot see through. The script does not resolve the
 * workbench, read a file under it, or shell into it — it names it, exactly as ADR
 * 0040 §3 says a comment may. The import net still reads this file.
 *
 * A second entry here is an argument to have in a pull request rather than a line to
 * add quietly; several would mean the text net has stopped being a net and become a
 * list of the files that are allowed through it.
 */
const NAMES_IT_IN_PROSE: Record<string, string> = {
  'apps/mobile/scripts/generate-component-ids.mjs':
    "the error message and the doc comment it writes into `src/gallery/components.generated.ts`, which name the workbench's `api.mjs` as the third place a component address is spelled",
};

describe('the app does not depend on the workbench', () => {
  const configs = configurationFiles();
  const sources = sourceFiles();

  /**
   * The guard against a scan that matches nothing, which is the state every check
   * in this file would otherwise report as success.
   *
   * Four ways this can go quiet: the walk finds no files, the configuration set
   * loses the entries that matter, a named file is renamed and silently drops out,
   * or a file is read and comes back BLANK. All four are red here rather than green
   * everywhere else.
   */
  it('reads the files it claims to (guards against a silently empty scan)', () => {
    const missing = TOOLCHAIN.filter((entry) => !existsSync(join(REPO, entry.path))).map(
      (entry) => `${entry.path} — on the list because ${entry.why}`,
    );

    expect(missing).toEqual([]);
    expect(configs.length).toBeGreaterThan(20);
    expect(sources.length).toBeGreaterThan(200);
    expect(sources.map(rel)).toContain(THIS_FILE);
  });

  /**
   * And the fourth one on its own, because it is the way this check actually failed
   * first and nothing about it looked like a failure.
   *
   * `withoutComments` is a pair of regular expressions. Until 2026-09-17 a block
   * comment opened on a slash-star anywhere, so the first `paths` entry in
   * `apps/mobile/tsconfig.json` — written `"@` slash star `"` — opened one and the
   * first recursive glob under `include` closed it: every path alias the file has
   * came back blank, and this check went green on a `paths` entry pointing straight
   * into the workbench. `jest.config.js` carries the same pair in `testMatch`.
   *
   * Every JSON the check reads therefore has to still BE JSON once its comments are
   * out. It is the cheapest total statement available — a file the stripper has
   * eaten the middle of does not parse — and unlike a length or a keyword it needs
   * no number that goes stale. tsconfig is JSONC, which is why this runs after the
   * strip rather than before it.
   */
  it('reads JSON that is still JSON once the comments are out', () => {
    const broken = [...configs, ...sources]
      .filter((full) => full.endsWith('.json'))
      .flatMap((full) => {
        try {
          JSON.parse(withoutComments(readFileSync(full, 'utf8')));
          return [];
        } catch (error) {
          return [`${rel(full)} — ${(error as Error).message.split('\n')[0]}`];
        }
      });

    expect(broken).toEqual([]);
  });

  /**
   * The second guard, and the one that can go wrong without anything looking
   * wrong: every assertion below reads source through REACHES, so a pattern that
   * stopped matching would report an app with no dependency on anything and pass.
   * One fixture per shape, so a shape that falls out of the net fails here by name.
   *
   * The second half is the other direction, and it is the part that keeps this
   * check honest rather than merely strict: everything the app writes about the
   * workbench today has to stay green, or the check is one somebody will delete
   * the first time it is in the way.
   */
  it('catches every shape it claims to, and nothing that is correct today', () => {
    const caught = (text: string): string[] => reachesIn(text).map((reach) => reach.name);

    // The import shape is written as the SPECIFIER rather than as a whole
    // `import … from …` statement, and that is the last assertion in this file
    // proving itself: the import net below excuses nothing, not even this file, so a
    // fixture written as a real import statement is a real import statement as far
    // as it is concerned. It failed exactly that way once, which is how this comment
    // came to be here.
    expect(caught('@correctiv/workbench/preview')).toEqual(['@correctiv/workbench']);
    expect(caught('"@correctiv/workbench": "*"')).toEqual(['@correctiv/workbench']);
    expect(caught('"build:web": "npm run build -w @correctiv/workbench && expo export"')).toEqual([
      '@correctiv/workbench',
    ]);
    expect(caught("@source '../../workbench/src';")).toEqual(['../workbench']);
    expect(caught("config.watchFolders = [path.resolve(root, 'apps/workbench')];")).toEqual([
      'apps/workbench',
    ]);
    expect(caught('"@/workbench/*": ["../../apps/workbench/src/*"]')).toEqual(['apps/workbench']);

    // And the permitted direction, the declared seam and the prose. Each of these
    // is written in the app today; every one of them must stay green.
    expect(caught("const SEEDED_KEY = 'workbench:seeded';")).toEqual([]);
    expect(caught("export const HOME_LAYOUT_OVERRIDE_KEY = 'workbench:home-layout';")).toEqual([]);
    expect(caught("export const HOME_TIME_OVERRIDE_KEY = 'workbench:home-time';")).toEqual([]);
    expect(caught("const label = 'open the workbench';")).toEqual([]);
  });

  /**
   * Every manifest, read as data rather than as text, because a dependency entry is
   * the shape that goes green when the directory is gone: the workspace symlink is
   * what makes the import compile, and without it the entry is a line nobody has
   * used YET. A dependency declared is a dependency that will be used.
   */
  it('declares no dependency on the workbench, in any manifest', () => {
    const fields = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ] as const;

    // The repository root is read too. Its own manifest names no `@correctiv/*` at
    // all — the workspace list is the glob `apps/*` — so a package name appearing
    // there would be somebody installing the workbench for every workspace at once,
    // which is the same entry with a wider blast radius.
    const offenders = [REPO, ...scannedWorkspaces()].flatMap((root) => {
      const path = join(root, 'package.json');
      if (!existsSync(path)) return [];
      const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<
        string,
        Record<string, string> | undefined
      >;
      return fields.flatMap((field) =>
        Object.keys(manifest[field] ?? {})
          .filter((name) => reachesIn(name).length > 0)
          .map((name) => `${rel(path)}: ${field}.${name}`),
      );
    });

    expect(offenders).toEqual([]);
  });

  /**
   * A script of the app's shelling into the workbench workspace, which is the shape
   * with no import and no path in it: `npm run build -w @correctiv/workbench`
   * before the export, added for a good local reason, and the app's release path now
   * needs a developer tool to build.
   *
   * The ROOT manifest is read here too, and it is the delicate one, because the
   * repository's own scripts name the workbench on purpose — `npm run workbench`,
   * `build:workbench`, `workbench:renders`. What makes a root script the APP's is
   * that it delegates to `@correctiv/mobile`, so that is the rule: a script that
   * runs the app may not also name the workbench. `check`, `test` and `typecheck`
   * use `--workspaces` and reach both halves; they are the repository asking, not
   * the app, and they are not on this list.
   */
  it('runs no workbench script from a script that runs the app', () => {
    const offenders: string[] = [];

    for (const root of scannedWorkspaces()) {
      const path = join(root, 'package.json');
      if (!existsSync(path)) continue;
      const { scripts = {} } = JSON.parse(readFileSync(path, 'utf8')) as {
        scripts?: Record<string, string>;
      };
      for (const [name, command] of Object.entries(scripts)) {
        for (const reach of reachesIn(command)) {
          offenders.push(`${rel(path)}: ${name} → ${reach.name} (${reach.why})`);
        }
      }
    }

    const { scripts = {} } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    for (const [name, command] of Object.entries(scripts)) {
      if (!command.includes('@correctiv/mobile')) continue;
      for (const reach of reachesIn(command)) {
        offenders.push(`package.json: ${name} runs the app and names ${reach.name}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * The configuration files, read as text with their comments taken out.
   *
   * Comments are taken out because ADR 0040 §3 puts them on the correct side of the
   * line and the app is full of them: `global.css` explains at length why its
   * `@source` line exists and names the workbench test that fails if it goes, and
   * `AppEnvironment.tsx` names the workbench component that shares its provider
   * list. A comment names the other end of a seam so the next reader knows the seam
   * has two ends, and it compiles to nothing.
   */
  it('reaches into the workbench from no configuration file', () => {
    const offenders = configs.flatMap((full) => {
      const text = withoutComments(readFileSync(full, 'utf8'));
      return reachesIn(text).map((reach) => `${rel(full)} → ${reach.name} (${reach.why})`);
    });

    expect(offenders).toEqual([]);
  });

  /** The same read over the app's and the packages' source. */
  it('names the workbench in no source file, outside a comment', () => {
    const offenders = sources.flatMap((full) => {
      const name = rel(full);
      if (name === THIS_FILE || NAMES_IT_IN_PROSE[name]) return [];
      const text = withoutComments(readFileSync(full, 'utf8'));
      return reachesIn(text).map((reach) => `${rel(full)} → ${reach.name} (${reach.why})`);
    });

    expect(offenders).toEqual([]);
  });

  /**
   * And the one net with no exemptions at all, which is why the two above may have
   * them: an import is the shape that actually makes the app need the workbench to
   * exist, and nothing excuses one — not the generator, not this file. It reads the
   * shared matcher in `packages/app-core/test/support/source.ts`, whose own fixture,
   * the one that proves it still catches every form a specifier arrives in, lives
   * beside the core's platform check in `boundary.test.ts`.
   *
   * It reads the RAW text, comments included, and that is deliberate:
   * `withoutComments` has a known limit — it truncates a line at a `//` inside a
   * string literal — and a net that excuses nothing should not inherit an exemption
   * from a helper. The price is that a commented-out import of the workbench is red,
   * which is the right direction for a line somebody is about to uncomment.
   */
  it('imports the workbench from nowhere, with nothing excused', () => {
    const offenders = [...configs, ...sources].flatMap((full) => {
      const text = readFileSync(full, 'utf8');
      return [...text.matchAll(IMPORT_RE)]
        .map((match) => specifier(match))
        .filter((spec): spec is string => !!spec && reachesIn(spec).length > 0)
        .map((spec) => `${rel(full)} imports ${spec}`);
    });

    expect(offenders).toEqual([]);
  });

  /**
   * The excuse list, asserted in the direction a one-sided list cannot do: an entry
   * that no longer matches anything is an excuse left lying around for the next
   * person to read as permission. ADR 0031 — a ratchet is a debt, not a state.
   */
  it('excuses nothing that has stopped naming the workbench', () => {
    const stale = Object.keys(NAMES_IT_IN_PROSE).filter((name) => {
      const full = join(REPO, name);
      if (!existsSync(full)) return true;
      return reachesIn(withoutComments(readFileSync(full, 'utf8'))).length === 0;
    });

    expect(stale).toEqual([]);
  });
});
