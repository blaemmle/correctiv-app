import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_HOME_LAYOUT,
  formatTimeOfDay,
  HOME_LAYOUT_VERSION,
  homeLayoutDocument,
  minuteOfDay,
  nextMomentAfter,
  parseHomeLayout,
  parseTimeOfDay,
  reportLayoutProblems,
  sectionsAt,
  stateAt,
  type HomeLayout,
  type LayoutProblemCode,
} from '../src/lib/home-layout';
import type { ErrorReport } from '../src/ports';
import { configurePlatform, createMemoryPlatform, resetPlatform } from '../src/ports';

/**
 * The home screen's document, and what happens to one the app cannot fully read.
 *
 * Two halves. One is the MODEL — that rendering at a time is the fold of the moments up
 * to it, that a moment carrying no change is indistinguishable from its absence, that a
 * change inherits what it does not mention. Those are the properties ADR 0039 is an
 * argument for, and a change that broke one of them would still parse, still typecheck
 * and still draw a plausible home screen.
 *
 * The other is every assertion about a BAD document. A good one is checked by the app's
 * own suite as well, where it has to agree with a map of renderers; here the question is
 * only whether a fault costs one part of the document or the whole of it.
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

/** A parse that is expected to be clean, as a layout, so a test can fold it. */
function read(input: unknown): HomeLayout {
  const parse = parseHomeLayout(input);
  expect(parse.problems).toEqual([]);
  expect(parse.layout).not.toBeNull();
  return parse.layout!;
}

const AT = (hours: number, minutes = 0) => hours * 60 + minutes;

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

  /**
   * The behaviour the dayparts used to produce, kept across the change that removed
   * them.
   *
   * ADR 0039 §5 claims the four named hours expressed exactly two changes in this
   * document: the callout is lifted over the lead at midday and drops back afterwards.
   * That claim is the whole argument for deleting a concept, so it is asserted against
   * the shipped file rather than left in prose — and it is what would notice somebody
   * moving a moment while believing they were tidying.
   */
  it('lifts the callout over the lead between 11:00 and 14:00, and nowhere else', () => {
    const lifted = (minute: number) =>
      sectionsAt(DEFAULT_HOME_LAYOUT, minute)
        .map((s) => s.id)
        .includes('callout-lifted');

    expect([AT(0), AT(9), AT(10, 59), AT(14), AT(18), AT(23, 59)].map(lifted)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect([AT(11), AT(12, 30), AT(13, 59)].map(lifted)).toEqual([true, true, true]);
  });

  it('shows the callout exactly once at every minute of the day', () => {
    for (let minute = 0; minute < 24 * 60; minute += 7) {
      const callouts = sectionsAt(DEFAULT_HOME_LAYOUT, minute).filter(
        (s) => s.module === 'callout-teaser',
      );
      expect({ minute, count: callouts.length }).toEqual({ minute, count: 1 });
    }
  });
});

describe('a time of day, as the document writes it', () => {
  it.each([
    ['00:00', 0],
    ['05:30', 330],
    ['11:00', 660],
    ['23:59', 1439],
  ])('reads %s', (text, minute) => {
    expect(parseTimeOfDay(text)).toBe(minute);
    expect(formatTimeOfDay(minute)).toBe(text);
  });

  it.each([
    ['a single-digit hour', '9:30'],
    ['a single-digit minute', '09:5'],
    ['no separator', '0930'],
    ['an hour that is not one', '24:00'],
    ['a minute that is not one', '09:60'],
    ['a number', 930],
    ['nothing', null],
  ])('refuses %s', (_name, value) => {
    expect(parseTimeOfDay(value)).toBeNull();
  });

  it('reads the clock as a minute of the LOCAL day', () => {
    expect(minuteOfDay(new Date(2026, 8, 3, 18, 42))).toBe(AT(18, 42));
  });
});

describe('the fold, which is the whole model', () => {
  const day = {
    version: HOME_LAYOUT_VERSION,
    sections: [
      { id: 'header', module: 'home-header' },
      { id: 'hero', module: 'article-hero', settings: { pin: 'https://example.org/a' } },
      { id: 'lifted', module: 'callout-teaser', hidden: true },
      { id: 'rail', module: 'faktencheck-rail', settings: { count: 4 } },
    ],
    moments: [
      {
        at: '11:00',
        changes: [
          { id: 'lifted', hidden: false },
          { id: 'rail', settings: { count: 8 } },
        ],
      },
      { at: '14:00', changes: [{ id: 'lifted', hidden: true }] },
      { at: '18:00', changes: [{ id: 'hero', settings: { pin: null } }] },
    ],
  };

  const layout = () => read(day);

  it('is the sections as written before the first moment', () => {
    expect(stateAt(layout(), AT(9))).toEqual(layout().sections);
  });

  /** The property the editor's whole per-moment view rests on. */
  it('applies every moment at or before the minute, and no later one', () => {
    const at = (minute: number) =>
      Object.fromEntries(
        stateAt(layout(), minute).map((s) => [s.id, { hidden: Boolean(s.hidden), ...s.settings }]),
      );

    expect(at(AT(10, 59)).lifted).toEqual({ hidden: true });
    expect(at(AT(11)).lifted).toEqual({ hidden: false });
    expect(at(AT(13, 59)).lifted).toEqual({ hidden: false });
    expect(at(AT(14)).lifted).toEqual({ hidden: true });
  });

  /**
   * A change says only what differs, so everything it does not mention is carried.
   *
   * The 11:00 moment sets the rail's count and says nothing about the hero's pin; the
   * hero still has it. That is inheritance, and it is not implemented anywhere — it is
   * what folding a list of partial changes does.
   */
  it('carries what a change does not mention', () => {
    const noon = stateAt(layout(), AT(12));
    expect(noon.find((s) => s.id === 'hero')?.settings).toEqual({ pin: 'https://example.org/a' });
    expect(noon.find((s) => s.id === 'rail')?.settings).toEqual({ count: 8 });
  });

  it('merges settings key by key rather than replacing the object', () => {
    const merged = read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'rail', module: 'faktencheck-rail', settings: { count: 4 } }],
      moments: [{ at: '09:00', changes: [{ id: 'rail', settings: { count: 9 } }] }],
    });
    expect(stateAt(merged, AT(9))[0]?.settings).toEqual({ count: 9 });
  });

  /**
   * `null` is a value and not an absence, which is what lets a later moment take a pin
   * off again — ADR 0036 §3's "no override, so the rule runs", said at six in the
   * evening rather than for the whole day.
   */
  it('lets a later moment put a setting back to the rule', () => {
    expect(stateAt(layout(), AT(18)).find((s) => s.id === 'hero')?.settings).toEqual({ pin: null });
  });

  /**
   * The property that makes a moment worth being a thing at all: it is defined by what
   * it carries, so one carrying nothing is not a state of the screen.
   */
  it('renders a moment with no changes exactly as its absence', () => {
    const without = read({ version: HOME_LAYOUT_VERSION, sections: day.sections, moments: [] });
    const withEmpty = read({
      version: HOME_LAYOUT_VERSION,
      sections: day.sections,
      moments: [{ at: '07:00', changes: [] }, { at: '19:00' }],
    });

    for (const minute of [AT(0), AT(6, 59), AT(7), AT(12), AT(19), AT(23, 59)]) {
      expect(stateAt(withEmpty, minute)).toEqual(stateAt(without, minute));
    }
  });

  it('keeps the document order, whatever the moments did', () => {
    expect(sectionsAt(layout(), AT(12)).map((s) => s.id)).toEqual([
      'header',
      'hero',
      'lifted',
      'rail',
    ]);
  });

  it('drops what is hidden at that minute and nothing else', () => {
    expect(sectionsAt(layout(), AT(9)).map((s) => s.id)).toEqual(['header', 'hero', 'rail']);
  });

  /**
   * The order moments are WRITTEN in carries no meaning, so a document that lists them
   * backwards is the same document. That is why the parser sorts rather than complains.
   */
  it('reads moments written out of order as the same day', () => {
    const backwards = read({
      version: HOME_LAYOUT_VERSION,
      sections: day.sections,
      moments: [...day.moments].reverse(),
    });
    for (const minute of [AT(9), AT(11), AT(14), AT(18), AT(23)]) {
      expect(stateAt(backwards, minute)).toEqual(stateAt(layout(), minute));
    }
  });
});

describe('nextMomentAfter, which is what a host sets a timer to', () => {
  const layout = () =>
    read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'a', module: 'x' }],
      moments: [
        { at: '11:00', changes: [] },
        { at: '14:00', changes: [] },
      ],
    });

  it('answers with the next one today', () => {
    expect(nextMomentAfter(layout(), AT(9))).toBe(AT(11));
    expect(nextMomentAfter(layout(), AT(11))).toBe(AT(14));
  });

  it('wraps to the first one when the day’s moments are past', () => {
    expect(nextMomentAfter(layout(), AT(23, 30))).toBe(AT(11));
  });

  /** No moments is no wake-up: a screen that never changes needs no timer. */
  it('answers with nothing when the document has no moments', () => {
    const flat = read({ version: HOME_LAYOUT_VERSION, sections: [{ id: 'a', module: 'x' }] });
    expect(nextMomentAfter(flat, AT(9))).toBeNull();
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
    const parse = parseHomeLayout({ version: 2, sections: { hero: {} } });
    expect(parse.layout).toBeNull();
    expect(codes(parse)).toEqual(['sections-not-an-array']);
  });

  /**
   * ADR 0036 §7: the configuration moves faster than the app, so a document numbered for
   * a later one is read rather than refused. Reported, because a report is how anybody
   * finds out that this phone is behind.
   */
  it('reads a document numbered for a later app, and says so', () => {
    const parse = parseHomeLayout(document([section()], { version: 3 }));
    expect(parse.layout?.sections).toHaveLength(1);
    expect(parse.problems).toEqual([
      { code: 'version-unknown', context: { version: 3, expected: HOME_LAYOUT_VERSION } },
    ]);
  });

  /**
   * A version 1 document, which is the shape this app shipped with until ADR 0039.
   *
   * It is read and not refused, and what it loses is every section that carried
   * `dayparts` — a key nobody here can apply. There is deliberately no migration: the
   * document is compiled in, nothing has ever fetched one, and a migration written
   * against a document that was never served is a guess with upkeep. This is here so
   * that the behaviour is a decision somebody can read rather than a surprise.
   */
  it('reads a version 1 document and drops the sections that named dayparts', () => {
    const parse = parseHomeLayout({
      version: 1,
      sections: [
        { id: 'header', module: 'home-header' },
        { id: 'callout', module: 'callout-teaser', dayparts: ['midday'] },
      ],
    });
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['header']);
    expect(codes(parse)).toEqual(['version-unknown', 'section-unknown-key']);
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
      'a hidden flag that is not a boolean',
      section({ hidden: 'yes' }),
      { code: 'section-hidden-invalid', context: { id: 'hero', type: 'string' } },
    ],
    [
      'a key nobody here knows',
      section({ pinned: 'article-1' }),
      { code: 'section-unknown-key', context: { id: 'hero', key: 'pinned' } },
    ],
    [
      'settings that are not an object',
      section({ module: 'article-hero', settings: 'pin' }),
      { code: 'section-settings-invalid', context: { id: 'hero', type: 'string' } },
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
        section({ id: 'callout-lifted', module: 'callout-teaser', hidden: true }),
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

describe('parseHomeLayout, on the settings a module understands', () => {
  const hero = (settings: unknown) => section({ id: 'hero', module: 'article-hero', settings });

  it('takes a pin, and takes null for the rule running', () => {
    expect(read(document([hero({ pin: 'https://example.org/a' })])).sections[0]?.settings).toEqual({
      pin: 'https://example.org/a',
    });
    expect(read(document([hero({ pin: null })])).sections[0]?.settings).toEqual({ pin: null });
  });

  it('takes a count inside the module’s bounds and refuses one outside them', () => {
    const rail = (count: unknown) =>
      section({ id: 'rail', module: 'faktencheck-rail', settings: { count } });
    expect(read(document([rail(3)])).sections[0]?.settings).toEqual({ count: 3 });
    expect(codes(parseHomeLayout(document([rail(0)])))).toEqual(['section-setting-invalid']);
    expect(codes(parseHomeLayout(document([rail(99)])))).toEqual(['section-setting-invalid']);
    expect(codes(parseHomeLayout(document([rail(2.5)])))).toEqual(['section-setting-invalid']);
  });

  /**
   * The rule the brief asked for: a setting a module does not understand is REPORTED,
   * and the rest of the screen survives.
   *
   * Its own section goes, for the reason an unrecognised key goes: a place configured by
   * a rule this app cannot apply is a place showing something nobody chose, and a
   * setting changes what a place SHOWS rather than how it looks. Two rules for "a word
   * this app does not know" would have been the second mechanism ADR 0036 §6 warns
   * about.
   */
  it('drops the section carrying an unknown setting, reports it, and keeps the rest', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'header', module: 'home-header' }),
        hero({ pin: 'https://example.org/a', tone: 'loud' }),
        section({ id: 'impact', module: 'impact-footer' }),
      ]),
    );
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['header', 'impact']);
    expect(parse.problems).toEqual([
      {
        code: 'section-setting-unknown',
        context: { id: 'hero', module: 'article-hero', key: 'tone' },
      },
    ]);
  });

  it('reports a setting on a module that understands none', () => {
    const parse = parseHomeLayout(
      document([section({ id: 'x', module: 'impact-footer', settings: { count: 2 } })]),
    );
    expect(codes(parse)).toEqual(['section-setting-unknown']);
  });

  it('leaves an empty settings object out of the parse', () => {
    const parse = parseHomeLayout(document([hero({})]));
    expect(parse.problems).toEqual([]);
    expect(Object.keys(parse.layout!.sections[0]!)).toEqual(['id', 'module']);
  });
});

describe('parseHomeLayout, on the moments', () => {
  const withMoments = (moments: unknown) =>
    parseHomeLayout({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'hero', module: 'article-hero' }],
      moments,
    });

  it('reads no moments at all as a screen that does not change', () => {
    const parse = withMoments(undefined);
    expect(parse.problems).toEqual([]);
    expect(parse.layout?.moments).toEqual([]);
  });

  it('refuses a moments field that is not a list, and keeps the sections', () => {
    const parse = withMoments({ '11:00': [] });
    expect(codes(parse)).toEqual(['moments-not-an-array']);
    expect(parse.layout?.sections).toHaveLength(1);
  });

  it.each([
    ['not an object', 'x', 'moment-not-an-object'],
    ['a time that is not one', { at: 'lunchtime', changes: [] }, 'moment-time-invalid'],
    ['no time at all', { changes: [] }, 'moment-time-invalid'],
    ['a key nobody here knows', { at: '11:00', repeat: 'daily' }, 'moment-unknown-key'],
    ['changes that are not a list', { at: '11:00', changes: {} }, 'moment-changes-invalid'],
  ])('drops a moment that is %s', (_name, bad, code) => {
    const parse = withMoments([bad]);
    expect(codes(parse)).toEqual([code]);
    expect(parse.layout?.moments).toEqual([]);
  });

  /**
   * Two moments at one time is the one case where the order they were written in would
   * decide something, so it is the one case that is refused rather than sorted.
   */
  it('keeps the first of two moments at the same time', () => {
    const parse = withMoments([
      { at: '11:00', changes: [{ id: 'hero', hidden: true }] },
      { at: '11:00', changes: [{ id: 'hero', hidden: false }] },
    ]);
    expect(parse.layout?.moments).toHaveLength(1);
    expect(parse.layout?.moments[0]?.changes).toEqual([{ id: 'hero', hidden: true }]);
    expect(parse.problems).toEqual([
      { code: 'moment-time-duplicate', context: { index: 1, at: '11:00' } },
    ]);
  });

  it('costs one change and never the moment', () => {
    const parse = withMoments([
      {
        at: '11:00',
        changes: [
          { id: 'hero', hidden: true },
          { id: 'hero', rule: 'newest' },
        ],
      },
    ]);
    expect(parse.layout?.moments[0]?.changes).toEqual([{ id: 'hero', hidden: true }]);
    expect(parse.problems).toEqual([
      { code: 'change-unknown-key', context: { at: '11:00', id: 'hero', key: 'rule' } },
    ]);
  });

  /**
   * A change about a place the document does not have does nothing, and doing nothing
   * silently is how a newsroom loses an edit without being told.
   */
  it('reports a change naming a section the document does not declare', () => {
    const parse = withMoments([{ at: '11:00', changes: [{ id: 'quiz', hidden: false }] }]);
    expect(parse.layout?.moments[0]?.changes).toEqual([]);
    expect(parse.problems).toEqual([
      { code: 'change-id-unknown', context: { at: '11:00', id: 'quiz' } },
    ]);
  });

  it.each([
    ['not an object', 'hero', 'change-not-an-object'],
    ['an id that is not one', { id: 7 }, 'change-id-invalid'],
    ['a hidden flag that is not a boolean', { id: 'hero', hidden: 'yes' }, 'change-hidden-invalid'],
    ['settings that are not an object', { id: 'hero', settings: 4 }, 'change-settings-invalid'],
    [
      'a setting the module has not got',
      { id: 'hero', settings: { tone: 'loud' } },
      'change-setting-unknown',
    ],
    [
      'a setting outside its bounds',
      { id: 'hero', settings: { pin: '' } },
      'change-setting-invalid',
    ],
  ])('drops a change that is %s', (_name, bad, code) => {
    const parse = withMoments([{ at: '11:00', changes: [bad] }]);
    expect(codes(parse)).toEqual([code]);
    expect(parse.layout?.moments[0]?.changes).toEqual([]);
  });

  it('carries the time in both spellings, and only the parsed one is derived', () => {
    const parse = withMoments([{ at: '09:30', changes: [] }]);
    expect(parse.layout?.moments[0]).toEqual({ at: '09:30', minute: 570, changes: [] });
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
