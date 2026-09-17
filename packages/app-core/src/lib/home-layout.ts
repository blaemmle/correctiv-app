/**
 * The home screen as a document, and what it takes to read one somebody else wrote.
 *
 * [ADR 0036](../../../../adr/0036-the-home-screen-becomes-data.md) turns the screen's
 * source order into `data/home.layout.json`: an ordered list of sections, each naming a
 * module the host can draw. The daypart table that used to live in `lib/daypart.ts` is
 * the same list — a section that should only appear between certain hours says so with
 * `dayparts`, and nothing else in the app has to know that a "timed module" is a
 * category of thing.
 *
 * ## Why this parses by hand and takes `unknown`
 *
 * §4 fetches this document from somewhere, which makes it **somebody else's file** even
 * when it is ours: a deploy can be half-written, a proxy can answer with an error page,
 * and an editor can save a document this app has never seen. So nothing here throws.
 * `parseHomeLayout` answers with the layout it could make sense of and a list of what it
 * could not, and the caller decides what to do with either.
 *
 * No schema library, and that is a decision rather than an omission. The whole grammar
 * is four keys over a flat list; a validator for it is the function below, and a
 * dependency would buy error objects this file has to translate into `ErrorReport`
 * context anyway. What it would buy is worth less than the third-party code in a bundle
 * that a phone downloads.
 *
 * ## Drawing past what it does not know, and where that stops
 *
 * §7 is the rule: the configuration moves faster than the app, so an app that refuses a
 * document it does not fully understand breaks every time the configuration is ahead of
 * it. Every fault below therefore costs exactly one section, never the document — and a
 * document that is not a document at all costs the fetched copy, not the screen, because
 * `DEFAULT_HOME_LAYOUT` is bundled and always usable (§10).
 *
 * The one thing that does NOT get drawn past is an unrecognised key inside a section,
 * which drops that section. A key nobody here knows is a rule nobody here can apply, and
 * a section drawn with a rule ignored is a section the newsroom believes it configured.
 * That is the failure §7 is about, pointed the other way.
 */

import homeLayoutDocument from '../data/home.layout.json';
import { platform } from '../ports';
import { isDaypart, type Daypart } from './daypart';

/**
 * The version this app was written against.
 *
 * ADR 0036 §6 argued for no version field at all, on the grounds that skipping what the
 * app does not recognise already answers the same question. The field is in the document
 * anyway, because the editor and the app agreed on the shape before that clause was
 * read, and because it costs one number to be able to say in a report WHICH document a
 * reader was looking at. It is deliberately not a gate: a document numbered for a later
 * app is reported and then read, section by section, exactly like every other one.
 */
export const HOME_LAYOUT_VERSION = 1;

/**
 * One place on the home screen.
 *
 * `id` is the stable address — it is what an editor writes against and what a report
 * names, so renaming one is a change to the document's meaning and not a tidy-up.
 * `module` names a renderer the host holds; two sections may name the same one, which is
 * how the callout gets two positions (ADR 0036 §2).
 *
 * Both optional fields are negative on purpose. `dayparts` absent means always, and
 * `hidden` absent means shown — the common case is the short line, so a document a
 * person reads is mostly ids and modules.
 */
export interface HomeSection {
  readonly id: string;
  readonly module: string;
  /** Restricts the section to these parts of the day. Absent means every one. */
  readonly dayparts?: readonly Daypart[];
  /** The editor switched this section off. Absent means shown. */
  readonly hidden?: boolean;
}

export interface HomeLayout {
  readonly version: number;
  /** Ordered: the host draws them in this order and adds no order of its own. */
  readonly sections: readonly HomeSection[];
}

/**
 * Every key a section may carry, as a `Record` over the interface rather than a list.
 *
 * Adding a field to `HomeSection` and forgetting it here is a compile error. Forgetting
 * it the other way round would be worse than a compile error: the field would be an
 * unrecognised key, so every section using it would be dropped and the screen would lose
 * the places the new field was added for.
 */
const SECTION_KEYS: Record<keyof HomeSection, true> = {
  id: true,
  module: true,
  dayparts: true,
  hidden: true,
};

/**
 * What a parse could not make sense of, one entry per fault.
 *
 * A code and values, never a sentence, because this goes out through `ErrorReporter` and
 * that port's contract is the same one `AudioError` follows: the caller knows what failed
 * and not what to say about it. `context` is what was already in hand — an index, an id,
 * the offending name — and matches `ErrorReport['context']` so it can be handed over
 * unchanged.
 */
export type LayoutProblemCode =
  | 'document-not-an-object'
  | 'version-invalid'
  | 'version-unknown'
  | 'sections-not-an-array'
  | 'section-not-an-object'
  | 'section-id-invalid'
  | 'section-module-invalid'
  | 'section-id-duplicate'
  | 'section-unknown-key'
  | 'section-dayparts-invalid'
  | 'section-daypart-unknown'
  | 'section-hidden-invalid'
  | 'module-unrecognised';

export interface LayoutProblem {
  readonly code: LayoutProblemCode;
  readonly context: Record<string, string | number | boolean | null>;
}

export interface HomeLayoutParse {
  /** Null when the document was not a layout at all — the caller falls back. */
  readonly layout: HomeLayout | null;
  readonly problems: readonly LayoutProblem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What a value IS, for a report, without pasting the value itself into one. */
function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Read a document into a layout, and say what could not be read.
 *
 * `renderable` is the host's half of ADR 0036 §14: the set of module names it actually
 * holds a renderer for. Given one, a section naming anything else is dropped here with
 * `module-unrecognised`, so the host renders what it is handed and never has to decide
 * what to do with a section it cannot draw. Left out — the bundled document's own parse
 * below, and every test about the grammar — module names are taken as written.
 */
export function parseHomeLayout(input: unknown, renderable?: ReadonlySet<string>): HomeLayoutParse {
  const problems: LayoutProblem[] = [];

  if (!isRecord(input)) {
    problems.push({ code: 'document-not-an-object', context: { type: typeOf(input) } });
    return { layout: null, problems };
  }

  const { version, sections } = input;

  if (typeof version !== 'number' || !Number.isFinite(version)) {
    problems.push({ code: 'version-invalid', context: { type: typeOf(version) } });
    return { layout: null, problems };
  }
  if (!Array.isArray(sections)) {
    problems.push({ code: 'sections-not-an-array', context: { type: typeOf(sections) } });
    return { layout: null, problems };
  }
  if (version !== HOME_LAYOUT_VERSION) {
    // Reported and then read anyway — see HOME_LAYOUT_VERSION.
    problems.push({ code: 'version-unknown', context: { version, expected: HOME_LAYOUT_VERSION } });
  }

  const parsed: HomeSection[] = [];
  const taken = new Set<string>();
  sections.forEach((raw, index) => {
    const section = parseSection(raw, index, taken, renderable, problems);
    if (!section) return;
    taken.add(section.id);
    parsed.push(section);
  });

  return { layout: { version, sections: parsed }, problems };
}

/** One section, or null with its fault appended to `problems`. */
function parseSection(
  raw: unknown,
  index: number,
  taken: ReadonlySet<string>,
  renderable: ReadonlySet<string> | undefined,
  problems: LayoutProblem[],
): HomeSection | null {
  if (!isRecord(raw)) {
    problems.push({ code: 'section-not-an-object', context: { index, type: typeOf(raw) } });
    return null;
  }

  const { id, module, dayparts, hidden } = raw;

  // The id first, because every problem after this one names it: a section whose id
  // cannot be read is one nobody can address, and `index` is all a report can offer.
  if (typeof id !== 'string' || id.length === 0) {
    problems.push({ code: 'section-id-invalid', context: { index, type: typeOf(id) } });
    return null;
  }
  if (typeof module !== 'string' || module.length === 0) {
    problems.push({ code: 'section-module-invalid', context: { id, type: typeOf(module) } });
    return null;
  }
  if (taken.has(id)) {
    // The first one wins. Not because it is more likely right, but because the
    // alternative is a rule about which duplicate the editor meant, and there is none.
    problems.push({ code: 'section-id-duplicate', context: { id, index } });
    return null;
  }

  const unknownKeys = Object.keys(raw).filter((key) => !Object.hasOwn(SECTION_KEYS, key));
  if (unknownKeys.length > 0) {
    for (const key of unknownKeys) {
      problems.push({ code: 'section-unknown-key', context: { id, key } });
    }
    return null;
  }

  let parsedDayparts: readonly Daypart[] | undefined;
  if (dayparts !== undefined) {
    if (!Array.isArray(dayparts)) {
      problems.push({ code: 'section-dayparts-invalid', context: { id, type: typeOf(dayparts) } });
      return null;
    }
    for (const part of dayparts) {
      if (!isDaypart(part)) {
        problems.push({
          code: 'section-daypart-unknown',
          context: { id, daypart: typeof part === 'string' ? part : typeOf(part) },
        });
        return null;
      }
    }
    parsedDayparts = dayparts as readonly Daypart[];
  }

  if (hidden !== undefined && typeof hidden !== 'boolean') {
    problems.push({ code: 'section-hidden-invalid', context: { id, type: typeOf(hidden) } });
    return null;
  }

  if (renderable && !renderable.has(module)) {
    problems.push({ code: 'module-unrecognised', context: { id, module } });
    return null;
  }

  return {
    id,
    module,
    ...(parsedDayparts ? { dayparts: parsedDayparts } : {}),
    ...(hidden === undefined ? {} : { hidden }),
  };
}

/**
 * Send a parse's problems out through the `ErrorReporter` port.
 *
 * Separate from `parseHomeLayout` so that the parser stays a pure function of its input,
 * and IN THE CORE rather than in the host because ADR 0036 §7 puts it there: the
 * document is parsed here, so this is the only place that can see a document that
 * parsed half. ADR 0032's two permitted reporters are unchanged by it — the host's error
 * boundary, and the core.
 *
 * **Once per document, not once per render.** This is a plain function with no memory of
 * its own; what makes the promise true is that the host calls it where it reads the
 * document (`apps/mobile/src/lib/home/layout.ts` parses once and keeps the answer), and
 * that is asserted there rather than assumed here. A reporter that fires on every frame
 * is not a louder report, it is a log nobody reads.
 */
export function reportLayoutProblems(problems: readonly LayoutProblem[]): void {
  for (const problem of problems) {
    const code: LayoutProblemCode = problem.code;
    platform().errors.report({ domain: 'layout', code, context: problem.context });
  }
}

/**
 * The sections to draw in a given part of the day, in the document's order.
 *
 * A selector over the document rather than a method on anything, per the core's own
 * rule, and the daypart is a parameter rather than a clock: a host owns the timer that
 * says when the answer changes (`nextDaypartChange`), and a test names an hour.
 */
export function sectionsAt(layout: HomeLayout, daypart: Daypart): readonly HomeSection[] {
  return layout.sections.filter(
    (section) => !section.hidden && (!section.dayparts || section.dayparts.includes(daypart)),
  );
}

const bundled = parseHomeLayout(homeLayoutDocument);

/**
 * The layout compiled into the app, which ADR 0036 §10 requires: "the last state" does
 * not exist on a first launch with no network, and the only thing that works there is a
 * document in the bundle.
 *
 * It is also what a fetched document falls back TO, so it is parsed without a
 * `renderable` set — a host asks for its own filtering when it parses the document it
 * actually read. `test/home-layout.test.ts` holds this to parsing clean and non-empty,
 * which is what makes the `?? DEFAULT_HOME_LAYOUT` at every call site worth writing.
 */
export const DEFAULT_HOME_LAYOUT: HomeLayout = bundled.layout ?? {
  version: HOME_LAYOUT_VERSION,
  sections: [],
};

/** The bundled document as it was written — what a fetched one replaces. */
export { homeLayoutDocument };
