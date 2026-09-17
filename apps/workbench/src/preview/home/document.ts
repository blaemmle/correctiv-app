import { DAYPART_HOURS, DAYPARTS, type Daypart } from '@correctiv/app-core/lib/daypart';
import {
  DEFAULT_HOME_LAYOUT,
  type HomeLayout,
  type HomeSection,
} from '@correctiv/app-core/lib/home-layout';

/**
 * The home document, as a thing that can be edited and printed.
 *
 * Every export here is a pure function of a layout, or a name both ends of the tool have
 * to spell the same way. The two ways a change leaves the page — into the running app,
 * and into the repository — are `write.ts`, and they are separate for a reason that is
 * not tidiness: **this file is imported by the dev server**. `plugin/home-layout.ts`
 * prints what it writes with `formatLayoutDocument` below, so a browser-only line here
 * (`window`, `import.meta.env`) would be an exception thrown while Vite loads its own
 * config, and the whole site would fail to start.
 *
 * The tool's component (`HomeDocument.tsx`) reads the layout from `./store.ts` and calls
 * these; nothing in this file holds state of its own, so a second caller — the endpoint,
 * a test, a scenario loader when ADR 0036 §11 is built — costs nothing.
 *
 * **This is the first module under `src/` to import the core.** It was test-only until
 * now, on the grounds that the shell re-implements the app's storage layout rather than
 * depending on it (`test/preview/seed.test.ts` says why). The reason does not reach the
 * home document: ADR 0036 §12 wants one validator rather than two that disagree, and
 * §14 wants one definition rather than three copies of it. Re-implementing
 * `parseHomeLayout` here would be exactly the second copy those two decisions exist to
 * prevent. What it costs the bundle is `lib/home-layout.ts`, `lib/daypart.ts`, the
 * ports module they reach for a report, and the shipped JSON — no React, no store, no
 * service.
 */

/**
 * The document the app compiles in, as the editor's starting point and its baseline.
 *
 * `DEFAULT_HOME_LAYOUT` is the core's own parse of `data/home.layout.json`, which is
 * the same value the app draws from when nothing has been written over it. So "reset"
 * and "unchanged" are both measured against the file a reviewer will see in the diff,
 * and not against a copy of it kept here.
 */
export const SHIPPED: HomeLayout = DEFAULT_HOME_LAYOUT;

/**
 * What each module is, in words an editor can act on.
 *
 * The module id is the app's vocabulary and it is not this tool's to show as the name
 * of a thing: `faktencheck-rail` tells a newsroom nothing about what it will see.
 * `test/preview/home-document.test.ts` reads `HOME_MODULES` out of
 * `apps/mobile/src/lib/home/modules.tsx` as source text — the shell may not import from
 * the app — and fails on a module with no entry here as well as on an entry no module
 * answers to, which is the direction a type cannot see.
 */
export const MODULE_LABELS: Readonly<Record<string, { name: string; what: string }>> = {
  'home-header': { name: 'Header', what: 'The date, the greeting and the way into search.' },
  'feed-status': {
    name: 'Loading and offline notice',
    what: 'Only appears while the feeds load, or when they came out of the bundle.',
  },
  'article-hero': { name: 'Lead article', what: 'The newest investigation, full width.' },
  'spotlight-briefing': {
    name: 'Spotlight briefing',
    what: 'The current issue, with the way into the archive.',
  },
  'early-access-card': {
    name: 'Early access',
    what: 'What members see before everybody else.',
  },
  'latest-research': {
    name: 'Latest investigations',
    what: 'The five investigations under the lead, as a list.',
  },
  'faktencheck-rail': {
    name: 'Fact checks',
    what: 'The newest fact checks, as a row that scrolls sideways.',
  },
  'callout-teaser': {
    name: 'Participation callout',
    what: 'The open callout. Two places in the document, one per part of the day.',
  },
  'mediathek-reihe': { name: 'Mediathek', what: 'Video and audio, as a row.' },
  'backstage-teaser': { name: 'Backstage', what: 'The newsroom diary and the way in.' },
  'impact-footer': { name: 'Impact', what: 'What the reporting changed, and a thank-you.' },
};

/** A module with no entry above still has to draw a row, and its id is what is left. */
export function moduleLabel(module: string): { name: string; what: string } {
  return MODULE_LABELS[module] ?? { name: module, what: 'This tool has no description for it.' };
}

/** The parts of the day, as a person says them. */
const DAYPART_NAMES: Record<Daypart, string> = {
  morning: 'Morning',
  midday: 'Midday',
  evening: 'Evening',
  'off-hours': 'The rest',
};

export function daypartName(daypart: Daypart): string {
  return DAYPART_NAMES[daypart];
}

/**
 * The same, with the hours the core actually uses.
 *
 * The hours come from `DAYPART_HOURS` rather than from a sentence typed here, because
 * they are editorial numbers somebody is expected to argue with — `lib/daypart.ts` says
 * so in as many words — and a tool that printed its own copy of them would be the place
 * the argument went wrong.
 *
 * Two functions rather than one, and the reason is the panel's width. Four chips with
 * the hours in them wrap onto two lines at a third of a 1440 window, and twelve rows of
 * that is a list nobody can see the shape of. The chips carry the name and the hours in
 * their `title`; the sentence under the list, written once, carries them in full.
 */
export function daypartLabel(daypart: Daypart): string {
  const hours = DAYPART_HOURS[daypart as Exclude<Daypart, 'off-hours'>];
  const name = DAYPART_NAMES[daypart];
  return hours ? `${name} ${hours[0]}–${hours[1]}` : name;
}

export { DAYPARTS, type Daypart };

// --- editing ------------------------------------------------------------------

/** The whole vocabulary: a section moves, switches off, or changes its hours. */
function replace(layout: HomeLayout, id: string, next: (section: HomeSection) => HomeSection) {
  return {
    ...layout,
    sections: layout.sections.map((section) => (section.id === id ? next(section) : section)),
  };
}

/**
 * One step up or down, in the document's own order.
 *
 * Over the whole list rather than over what is on screen right now: the document is one
 * order and the daypart is a filter over it, so moving a midday-only section past one
 * that never appears at midday still means something and still has to be expressible.
 * At either end this answers with the layout it was given, so a button that cannot move
 * anything changes nothing rather than wrapping around.
 */
export function moved(layout: HomeLayout, id: string, delta: -1 | 1): HomeLayout {
  const from = layout.sections.findIndex((section) => section.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= layout.sections.length) return layout;
  const sections = [...layout.sections];
  const [lifted] = sections.splice(from, 1);
  sections.splice(to, 0, lifted!);
  return { ...layout, sections };
}

/**
 * On and off.
 *
 * Written as `hidden: true` and then taken out again rather than written `false`,
 * because the document's optional fields are negative on purpose — absent means shown —
 * and a document full of `"hidden": false` is a document that got longer without saying
 * anything more.
 */
export function toggledHidden(layout: HomeLayout, id: string): HomeLayout {
  return replace(layout, id, (section) => {
    if (section.hidden) {
      const { hidden: _hidden, ...rest } = section;
      return rest;
    }
    return { ...section, hidden: true };
  });
}

/**
 * The parts of the day a section appears in.
 *
 * Every daypart selected is written as no `dayparts` key at all. The two mean the same
 * thing to `sectionsAt`, and the short one is the one a person reads: absent means
 * always, which is the rule `HomeSection` states and this is the only place that can
 * keep the document honest to it.
 *
 * The list is put back in `DAYPARTS` order rather than in the order the toggles were
 * clicked, so the same choice always writes the same line and a diff shows an edit
 * rather than a shuffle.
 */
export function withDayparts(
  layout: HomeLayout,
  id: string,
  chosen: ReadonlySet<Daypart>,
): HomeLayout {
  return replace(layout, id, (section) => {
    const { dayparts: _dayparts, ...rest } = section;
    if (chosen.size === 0 || chosen.size === DAYPARTS.length) return rest;
    return { ...rest, dayparts: DAYPARTS.filter((part) => chosen.has(part)) };
  });
}

/** What a section's toggles show: an absent list is every daypart, not none. */
export function daypartsOf(section: HomeSection): ReadonlySet<Daypart> {
  return new Set(section.dayparts ?? DAYPARTS);
}

// --- what changed -------------------------------------------------------------

/**
 * The ids whose place, switch or hours differ from the shipped document.
 *
 * Position included, which is why this cannot be a per-section comparison: a section
 * that moved makes its neighbour move too, and an editor who lifted one block should
 * not be told they changed four. So position is compared against the shipped index of
 * the same id, and the count is honest about the blast radius rather than flattering.
 */
export function changed(layout: HomeLayout): readonly string[] {
  const before = new Map(
    SHIPPED.sections.map((section, index) => [section.id, { section, index }]),
  );
  return layout.sections
    .filter((section, index) => {
      const was = before.get(section.id);
      if (!was) return true;
      return (
        was.index !== index ||
        Boolean(was.section.hidden) !== Boolean(section.hidden) ||
        [...daypartsOf(was.section)].join() !== [...daypartsOf(section)].join()
      );
    })
    .map((section) => section.id);
}

// --- the file ------------------------------------------------------------------

/**
 * The document as `packages/app-core/src/data/home.layout.json` should read.
 *
 * `JSON.stringify(…, 2)` is not this, and the difference is the whole point: it puts
 * every key of every section on a line of its own, so saving an unchanged document
 * would produce a 60-line diff that says nothing. What oxfmt does to JSON is width and
 * nothing else — measured, not assumed: a group goes on one line when the rendered
 * line, its indent and its trailing comma included, is at most `printWidth`, and the
 * source's own line breaks are not preserved. So this prints each section on one line
 * and breaks the ones that do not fit, which is what the shipped document already looks
 * like.
 *
 * `test/preview/home-document.test.ts` runs the repository's own oxfmt over the output
 * and fails if the two disagree. That check is why this can be a fifteen-line printer
 * rather than a formatter: it is allowed to be wrong in a way somebody notices.
 */
const PRINT_WIDTH = 100;
const INDENT = '  ';

/**
 * An object as an ordered list of entries, tagged.
 *
 * Tagged because the untagged form is ambiguous exactly where this file uses it: a
 * section with two fields is `[['id', …], ['module', …]]`, and a list of two sections is
 * an array of two arrays. Nothing can tell those apart by shape, and the first document
 * to have exactly two two-field sections would have come out as an object.
 */
interface Obj {
  readonly obj: readonly (readonly [string, unknown])[];
}

const obj = (entries: readonly (readonly [string, unknown])[]): Obj => ({ obj: entries });

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && 'obj' in value;
}

/** `{ "a": 1 }` and `[1, 2]` with the spacing `.oxfmtrc.json` asks for, however long. */
function flat(value: unknown): string {
  if (isObj(value)) {
    if (value.obj.length === 0) return '{}';
    const pairs = value.obj.map(([key, item]) => `${JSON.stringify(key)}: ${flat(item)}`);
    return `{ ${pairs.join(', ')} }`;
  }
  if (Array.isArray(value)) return `[${value.map(flat).join(', ')}]`;
  return JSON.stringify(value);
}

/**
 * One value, broken across lines only where it has to be.
 *
 * `column` is how much of the line is already spent before the value starts — the indent
 * plus, for an object's member, its key and colon. It and `trailing` are both part of
 * the measurement rather than afterthoughts, because they are both part of the line: the
 * shipped document's longest section is exactly 100 characters without its comma and
 * breaks with it, which is how the boundary was measured against oxfmt itself.
 *
 * The first line carries no indent of its own; the caller has already written it.
 */
function print(value: unknown, column: number, depth: number, trailing: string): string {
  const one = `${flat(value)}${trailing}`;
  if (column + one.length <= PRINT_WIDTH) return one;

  const pad = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);

  if (isObj(value)) {
    const lines = value.obj.map(([key, item], i) => {
      const head = `${inner}${JSON.stringify(key)}: `;
      const comma = i === value.obj.length - 1 ? '' : ',';
      return head + print(item, head.length, depth + 1, comma);
    });
    return `{\n${lines.join('\n')}\n${pad}}${trailing}`;
  }
  if (Array.isArray(value)) {
    const items = value.map((item, i) => {
      const comma = i === value.length - 1 ? '' : ',';
      return inner + print(item, inner.length, depth + 1, comma);
    });
    return `[\n${items.join('\n')}\n${pad}]${trailing}`;
  }
  return one;
}

/**
 * The order `HomeSection` declares, so a section that gains a field gains it in the same
 * place in every line of the file, and the two optional ones are written only when they
 * say something.
 */
function sectionEntries(section: HomeSection): Obj {
  const entries: (readonly [string, unknown])[] = [
    ['id', section.id],
    ['module', section.module],
  ];
  if (section.dayparts) entries.push(['dayparts', [...section.dayparts]]);
  if (section.hidden !== undefined) entries.push(['hidden', section.hidden]);
  return obj(entries);
}

export function formatLayoutDocument(layout: HomeLayout): string {
  const document = obj([
    ['version', layout.version],
    ['sections', layout.sections.map(sectionEntries)],
  ]);
  return `${print(document, 0, 0, '')}\n`;
}

// --- the two names both ends spell ----------------------------------------------

/**
 * Re-exported rather than declared here, and `names.ts` says why in full: the dev
 * server needs both before it can match a request, and it cannot import this file at
 * all, because Node will not follow the core's JSON import without an attribute.
 */
export { HOME_LAYOUT_ENDPOINT, HOME_LAYOUT_KEY } from './names';
