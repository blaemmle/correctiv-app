import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_HOME_LAYOUT,
  HOME_LAYOUT_VERSION,
  homeLayoutDocument,
  parseHomeLayout,
  reportLayoutProblems,
  sectionsAt,
  type HomeLayout,
  type LayoutProblemCode,
} from '../src/lib/home-layout';
import type { ErrorReport } from '../src/ports';
import { configurePlatform, createMemoryPlatform, resetPlatform } from '../src/ports';

/**
 * The home screen's document, and what happens to one the app cannot fully read.
 *
 * Every assertion about a BAD document is the point of the file. A good one is checked
 * by the app's own suite as well, where it has to agree with a map of renderers; here
 * the question is only whether a fault costs a section or the screen.
 *
 * The codes are typed on the way out (`LayoutProblemCode`), so a renamed code fails to
 * compile here rather than turning an assertion vacuous.
 */

/** Only the codes, in order — the context is asserted where it carries something. */
const codes = (parse: { problems: readonly { code: LayoutProblemCode }[] }): string[] =>
  parse.problems.map((problem) => problem.code);

const section = (over: Record<string, unknown> = {}) => ({ id: 'hero', module: 'a', ...over });
const document = (sections: unknown[], over: Record<string, unknown> = {}) => ({
  version: HOME_LAYOUT_VERSION,
  sections,
  ...over,
});

describe('the bundled document', () => {
  it('parses with nothing left over', () => {
    const parse = parseHomeLayout(homeLayoutDocument);
    expect(parse.problems).toEqual([]);
    expect(parse.layout).not.toBeNull();
  });

  /**
   * `DEFAULT_HOME_LAYOUT` is the fallback every caller writes `?? DEFAULT_HOME_LAYOUT`
   * against, and a fallback that is an empty screen is worse than the fault it catches.
   * The module cannot throw when its own document is broken — nothing here throws — so
   * this is what says it is not.
   */
  it('is what DEFAULT_HOME_LAYOUT holds, and it is not empty', () => {
    expect(DEFAULT_HOME_LAYOUT.version).toBe(HOME_LAYOUT_VERSION);
    expect(DEFAULT_HOME_LAYOUT.sections.length).toBeGreaterThan(0);
  });

  it('gives every section an id of its own', () => {
    const ids = DEFAULT_HOME_LAYOUT.sections.map((s) => s.id);
    expect([...new Set(ids)]).toEqual(ids);
  });
});

describe('parseHomeLayout, on a document it cannot use at all', () => {
  it.each([
    ['null', null],
    ['a string', '{"version":1}'],
    ['an array', []],
    ['a number', 7],
  ])('refuses %s and says what it got', (_name, input) => {
    const parse = parseHomeLayout(input);
    expect(parse.layout).toBeNull();
    expect(codes(parse)).toEqual(['document-not-an-object']);
  });

  it('refuses a document with no usable version', () => {
    const parse = parseHomeLayout({ sections: [] });
    expect(parse.layout).toBeNull();
    expect(parse.problems).toEqual([{ code: 'version-invalid', context: { type: 'undefined' } }]);
  });

  it('refuses a document whose sections are not a list', () => {
    const parse = parseHomeLayout({ version: 1, sections: { hero: {} } });
    expect(parse.layout).toBeNull();
    expect(codes(parse)).toEqual(['sections-not-an-array']);
  });

  /**
   * ADR 0036 §7: the configuration moves faster than the app, so a document numbered for
   * a later one is read rather than refused. Reported, because a report is how anybody
   * finds out that this phone is behind.
   */
  it('reads a document numbered for a later app, and says so', () => {
    const parse = parseHomeLayout(document([section()], { version: 2 }));
    expect(parse.layout?.sections).toHaveLength(1);
    expect(parse.problems).toEqual([
      { code: 'version-unknown', context: { version: 2, expected: HOME_LAYOUT_VERSION } },
    ]);
  });
});

describe('parseHomeLayout, on a section it cannot use', () => {
  /** The case the whole shape exists for: one bad section, the rest of the screen intact. */
  it('drops the bad one and keeps the good ones, in order', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'header', module: 'home-header' }),
        { id: 'broken' },
        section({ id: 'hero', module: 'article-hero' }),
      ]),
    );
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['header', 'hero']);
    expect(parse.problems).toEqual([
      { code: 'section-module-invalid', context: { id: 'broken', type: 'undefined' } },
    ]);
  });

  it.each([
    [
      'not an object',
      'hero',
      { code: 'section-not-an-object', context: { index: 0, type: 'string' } },
    ],
    [
      'an id that is not a string',
      section({ id: 7 }),
      { code: 'section-id-invalid', context: { index: 0, type: 'number' } },
    ],
    [
      'an empty id',
      section({ id: '' }),
      { code: 'section-id-invalid', context: { index: 0, type: 'string' } },
    ],
    [
      'a module that is missing',
      { id: 'hero' },
      { code: 'section-module-invalid', context: { id: 'hero', type: 'undefined' } },
    ],
    [
      'dayparts that are not a list',
      section({ dayparts: 'midday' }),
      { code: 'section-dayparts-invalid', context: { id: 'hero', type: 'string' } },
    ],
    [
      'a daypart that is not one',
      section({ dayparts: ['midday', 'teatime'] }),
      { code: 'section-daypart-unknown', context: { id: 'hero', daypart: 'teatime' } },
    ],
    [
      'a hidden flag that is not a boolean',
      section({ hidden: 'yes' }),
      { code: 'section-hidden-invalid', context: { id: 'hero', type: 'string' } },
    ],
    [
      'a key nobody here knows',
      section({ pinned: 'article-1' }),
      { code: 'section-unknown-key', context: { id: 'hero', key: 'pinned' } },
    ],
  ])('drops a section with %s', (_name, bad, problem) => {
    const parse = parseHomeLayout(document([bad]));
    expect(parse.layout?.sections).toEqual([]);
    expect(parse.problems).toEqual([problem]);
  });

  /**
   * An unknown key drops its section rather than being drawn past, and that is the one
   * place this parser is stricter than §7. A key nobody here knows is a rule nobody here
   * can apply, and a section drawn with its rule ignored is a section the newsroom
   * believes it configured.
   */
  it('names every unknown key on a section, not only the first', () => {
    const parse = parseHomeLayout(document([section({ pinned: 'a', rule: 'newest' })]));
    expect(parse.problems.map((p) => p.context.key)).toEqual(['pinned', 'rule']);
  });

  it('keeps the first of two sections sharing an id', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'hero', module: 'first' }),
        section({ id: 'hero', module: 'second' }),
      ]),
    );
    expect(parse.layout?.sections).toEqual([{ id: 'hero', module: 'first' }]);
    expect(parse.problems).toEqual([
      { code: 'section-id-duplicate', context: { id: 'hero', index: 1 } },
    ]);
  });

  it('lets two sections share a module', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'callout-lifted', module: 'callout-teaser', dayparts: ['midday'] }),
        section({ id: 'callout', module: 'callout-teaser' }),
      ]),
    );
    expect(parse.problems).toEqual([]);
    expect(parse.layout?.sections).toHaveLength(2);
  });

  /** The host's half of §14: a module it holds no renderer for is skipped and reported. */
  it('drops a module the host cannot draw, when it is told what the host can draw', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'hero', module: 'article-hero' }),
        section({ id: 'x', module: 'quiz' }),
      ]),
      new Set(['article-hero']),
    );
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['hero']);
    expect(parse.problems).toEqual([
      { code: 'module-unrecognised', context: { id: 'x', module: 'quiz' } },
    ]);
  });

  it('takes every module name as written when it is told nothing', () => {
    const parse = parseHomeLayout(document([section({ module: 'quiz' })]));
    expect(parse.problems).toEqual([]);
  });

  it('keeps the optional fields out of a section that did not carry them', () => {
    const parse = parseHomeLayout(document([section({ id: 'hero', module: 'article-hero' })]));
    expect(Object.keys(parse.layout!.sections[0]!)).toEqual(['id', 'module']);
  });
});

describe('sectionsAt', () => {
  const layout: HomeLayout = {
    version: 1,
    sections: [
      { id: 'header', module: 'home-header' },
      { id: 'callout-lifted', module: 'callout-teaser', dayparts: ['midday'] },
      { id: 'hero', module: 'article-hero' },
      { id: 'callout', module: 'callout-teaser', dayparts: ['morning', 'evening', 'off-hours'] },
      { id: 'briefing', module: 'spotlight-briefing', hidden: true },
    ],
  };

  it('keeps the document order', () => {
    expect(sectionsAt(layout, 'midday').map((s) => s.id)).toEqual([
      'header',
      'callout-lifted',
      'hero',
    ]);
  });

  it('drops a section that does not belong to this part of the day', () => {
    expect(sectionsAt(layout, 'evening').map((s) => s.id)).toEqual(['header', 'hero', 'callout']);
  });

  it('drops a section the editor switched off, in every daypart', () => {
    for (const daypart of ['morning', 'midday', 'evening', 'off-hours'] as const) {
      expect(sectionsAt(layout, daypart).map((s) => s.id)).not.toContain('briefing');
    }
  });

  it('shows a section with no dayparts at every hour', () => {
    for (const daypart of ['morning', 'midday', 'evening', 'off-hours'] as const) {
      expect(sectionsAt(layout, daypart).map((s) => s.id)).toContain('header');
    }
  });
});

describe('reportLayoutProblems', () => {
  afterEach(() => {
    resetPlatform();
  });

  it('sends one report per problem, through the port, in the layout domain', () => {
    const reports: ErrorReport[] = [];
    configurePlatform({
      ...createMemoryPlatform(),
      errors: { report: (report) => reports.push(report) },
    });

    const parse = parseHomeLayout(document([section({ id: 'x', module: 'quiz' })]), new Set());
    reportLayoutProblems(parse.problems);

    expect(reports).toEqual([
      { domain: 'layout', code: 'module-unrecognised', context: { id: 'x', module: 'quiz' } },
    ]);
  });

  it('reports nothing for a document with nothing wrong with it', () => {
    const reports: ErrorReport[] = [];
    configurePlatform({
      ...createMemoryPlatform(),
      errors: { report: (report) => reports.push(report) },
    });

    reportLayoutProblems(parseHomeLayout(homeLayoutDocument).problems);
    expect(reports).toEqual([]);
  });
});
