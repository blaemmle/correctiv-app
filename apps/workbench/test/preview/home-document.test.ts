import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseHomeLayout, type HomeLayout } from '@correctiv/app-core/lib/home-layout';

import { ROOT } from '../../plugin/collect.ts';
import {
  changed,
  DAYPARTS,
  daypartLabel,
  daypartsOf,
  formatLayoutDocument,
  HOME_LAYOUT_ENDPOINT,
  HOME_LAYOUT_KEY,
  moduleLabel,
  MODULE_LABELS,
  moved,
  SHIPPED,
  toggledHidden,
  withDayparts,
} from '../../src/preview/home/document';

/**
 * The home-layout editor, held to the three things it cannot check itself.
 *
 * **It prints the file the way the repository does.** Save is only worth having if the
 * diff it leaves says what was changed and nothing else, and a printer that puts every
 * key on its own line turns a one-line edit into a sixty-line diff. `JSON.stringify` is
 * that printer, which is why there is one here, and why it is measured against the
 * repository's own oxfmt rather than against a description of what oxfmt does.
 *
 * **It names the modules in words.** The labels are a second copy of the app's module
 * map, and the direction a type cannot see is an entry here that no module answers to.
 *
 * **Both halves spell the storage key the same way.** That one is silent in exactly the
 * way ADR 0014 warns about: every edit would still "succeed", the app would go on
 * drawing the compiled-in document, and nothing anywhere would say why.
 */

const FILE = 'packages/app-core/src/data/home.layout.json';

/** The order a layout puts its sections in, which is most of what an edit changes. */
function ids(layout: HomeLayout): string[] {
  return layout.sections.map((section) => section.id);
}

/** The shell may not import from `apps/mobile`, so the app is read as source text. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

/** Every source file under a directory, so a new one is checked without being listed. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * The repository's own formatter, over a document this file printed.
 *
 * Its config is found by searching up from `cwd`, so the cwd is the repository and not
 * this package: `.oxfmtrc.json` is at the root and `printWidth` is the whole question.
 */
function oxfmt(text: string): string {
  return execFileSync(
    join(ROOT, 'node_modules/.bin/oxfmt'),
    ['--stdin-filepath=home.layout.json'],
    {
      cwd: ROOT,
      input: text,
      encoding: 'utf8',
    },
  );
}

describe('the document the editor writes', () => {
  it('prints the shipped file byte for byte', () => {
    expect(formatLayoutDocument(SHIPPED)).toBe(source(FILE));
  });

  it('prints what oxfmt would print, for an edit of every kind', () => {
    const cases: HomeLayout[] = [
      SHIPPED,
      moved(SHIPPED, 'hero', -1),
      moved(SHIPPED, 'impact', -1),
      toggledHidden(SHIPPED, 'early-access'),
      withDayparts(SHIPPED, 'mediathek', new Set(['morning', 'evening'])),
      withDayparts(toggledHidden(SHIPPED, 'callout'), 'callout', new Set(['morning'])),
      // The edges: nothing left, a section carrying both optional fields, and the two
      // widths either side of the break. The longest line in the shipped document is
      // exactly `printWidth` without its trailing comma and breaks with it, so a printer
      // that forgets the comma is right on every document but this one.
      { version: 1, sections: [] },
      { version: 1, sections: [{ id: 'a', module: 'b', dayparts: ['midday'], hidden: true }] },
      {
        version: 1,
        sections: [
          { id: 'callout-lifted', module: 'callout-teaser', dayparts: ['morning', 'midday'] },
          {
            id: 'callout',
            module: 'callout-teaser',
            dayparts: ['morning', 'evening', 'off-hours'],
          },
        ],
      },
    ];

    for (const layout of cases) {
      const printed = formatLayoutDocument(layout);
      expect(oxfmt(printed)).toBe(printed);
    }
  });

  it('writes a document the core takes back without a problem', () => {
    const edited = withDayparts(
      toggledHidden(moved(SHIPPED, 'briefing', 1), 'backstage'),
      'mediathek',
      new Set(['evening']),
    );
    const { layout, problems } = parseHomeLayout(JSON.parse(formatLayoutDocument(edited)));
    expect(problems).toEqual([]);
    expect(layout).toEqual(edited);
  });

  it('leaves the two optional fields out when they say nothing', () => {
    // Every daypart chosen is the same rule as no `dayparts` key, and the short one is
    // what a person reads. Switching a section off and on again has to leave the line it
    // started as, or "off and on again" is a diff.
    const all = withDayparts(SHIPPED, 'callout', new Set(DAYPARTS));
    expect(formatLayoutDocument(all)).toContain('{ "id": "callout", "module": "callout-teaser" }');
    expect(formatLayoutDocument(toggledHidden(toggledHidden(SHIPPED, 'hero'), 'hero'))).toBe(
      source(FILE),
    );
    expect(formatLayoutDocument(withDayparts(SHIPPED, 'hero', new Set()))).toBe(source(FILE));
  });
});

describe('the vocabulary the editor offers', () => {
  it('moves a section one step, and refuses to move it off either end', () => {
    const first = SHIPPED.sections[0]!.id;
    const last = SHIPPED.sections.at(-1)!.id;

    expect(moved(SHIPPED, first, -1)).toBe(SHIPPED);
    expect(moved(SHIPPED, last, 1)).toBe(SHIPPED);
    expect(moved(SHIPPED, 'nothing-by-this-name', 1)).toBe(SHIPPED);
    expect(ids(moved(SHIPPED, 'hero', -1)).slice(0, 4)).toEqual([
      'header',
      'feed-status',
      'hero',
      'callout-lifted',
    ]);
  });

  it('counts a move as one change and not as two', () => {
    // A section that moved makes its neighbour move too, and an editor who lifted one
    // block should not be told they changed four.
    expect(changed(SHIPPED)).toEqual([]);
    expect(changed(moved(SHIPPED, 'hero', -1))).toEqual(['hero', 'callout-lifted']);
    expect(changed(toggledHidden(SHIPPED, 'impact'))).toEqual(['impact']);
    expect(changed(withDayparts(SHIPPED, 'impact', new Set(['morning'])))).toEqual(['impact']);
    expect(changed(withDayparts(SHIPPED, 'impact', new Set(DAYPARTS)))).toEqual([]);
  });

  it('reads an absent daypart list as every daypart, not as none', () => {
    const hero = SHIPPED.sections.find((section) => section.id === 'hero')!;
    expect(hero.dayparts).toBeUndefined();
    expect([...daypartsOf(hero)]).toEqual([...DAYPARTS]);
  });

  it('names the hours out of the core rather than out of a sentence', () => {
    // The numbers are editorial and somebody is expected to argue with them, so a copy
    // typed here would be the place the argument went wrong.
    const hours = source('packages/app-core/src/lib/daypart.ts');
    for (const part of DAYPARTS) {
      const label = daypartLabel(part);
      if (part === 'off-hours') continue;
      const [, from, to] = /(\d+)–(\d+)$/.exec(label)!;
      expect(hours).toMatch(new RegExp(`${part}:\\s*\\[${from},\\s*${to}\\]`));
    }
  });
});

describe('the words an editor reads', () => {
  const modules = source('apps/mobile/src/lib/home/modules.tsx');
  const mapped = [
    ...modules
      .slice(modules.indexOf('export const HOME_MODULES'))
      .matchAll(/^ {2}'([a-z0-9-]+)':/gm),
  ].map((hit) => hit[1]!);

  it('reads the app’s module map', () => {
    // A regular expression that stopped matching would make every assertion below
    // vacuously true, and the map is the thing being checked against.
    expect(mapped.length).toBeGreaterThan(8);
  });

  it('has a name and a description for every module the app can draw', () => {
    expect(mapped.filter((module) => !Object.hasOwn(MODULE_LABELS, module))).toEqual([]);
  });

  it('describes no module the app has not got', () => {
    expect(Object.keys(MODULE_LABELS).filter((module) => !mapped.includes(module))).toEqual([]);
  });

  it('shows no module id where a name belongs', () => {
    // The whole point of the labels: `faktencheck-rail` tells a newsroom nothing about
    // what it will see. A label that merely repeats the id is the failure, and it is one
    // a type cannot see.
    for (const [module, label] of Object.entries(MODULE_LABELS)) {
      expect(label.name).not.toBe(module);
      expect(label.name).not.toMatch(/-/);
      expect(label.what.length).toBeGreaterThan(20);
    }
  });

  it('still draws a row for a module it has never heard of', () => {
    // §7's rule, in the editor: a document ahead of this tool still has to be editable.
    expect(moduleLabel('something-new').name).toBe('something-new');
  });
});

describe('the two ends of the seam', () => {
  it('spells the storage key the way the app reads it', () => {
    const app = source('apps/mobile/src/lib/home/layout.ts');
    expect(app).toContain(`export const HOME_LAYOUT_OVERRIDE_KEY = '${HOME_LAYOUT_KEY}';`);
  });

  it('answers on the address the dev server listens on', () => {
    const plugin = source('apps/workbench/plugin/home-layout.ts');
    expect(plugin).toContain('HOME_LAYOUT_ENDPOINT');
    expect(HOME_LAYOUT_ENDPOINT.startsWith('/__workbench/')).toBe(true);
  });

  /**
   * The endpoint is not in the published bundle, and this is what says so.
   *
   * `configureServer` is a hook `vite build` never calls, so the middleware cannot reach
   * the published site — but only as long as nothing else imports it. An import of
   * `plugin/home-layout.ts` from anywhere under `src/` would put the write path, and
   * `node:fs` with it, into the bundle a browser downloads.
   */
  it('is reachable from the dev server and from nowhere in the bundle', () => {
    const index = source('apps/workbench/plugin/index.ts');
    expect(index).toContain('server.middlewares.use(homeLayoutEndpoint(server))');

    const importers = sources(join(ROOT, 'apps/workbench/src')).filter((file) =>
      /from\s+'[^']*plugin\/home-layout/.test(readFileSync(file, 'utf8')),
    );
    expect(importers).toEqual([]);
  });

  /**
   * And the parser it validates with is loaded through Vite rather than imported.
   *
   * A static import would be an exception thrown while `vite.config.ts` loads — Node
   * refuses the core's `data/home.layout.json` without an import attribute — and the
   * whole site would fail to start with an error about a JSON file. Easy to "fix" by
   * writing a second validator in the plugin, which is the copy ADR 0036 §12 exists to
   * prevent, so the constraint is written down where it would be undone.
   */
  it('loads the core through the dev server, not through Node', () => {
    const plugin = source('apps/workbench/plugin/home-layout.ts');
    expect(plugin).toContain("server.ssrLoadModule(\n      '@correctiv/app-core/lib/home-layout',");
    expect(plugin).not.toMatch(/^import .*@correctiv\/app-core/m);
  });
});
