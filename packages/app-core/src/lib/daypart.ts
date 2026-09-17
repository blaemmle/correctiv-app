/**
 * What part of the day it is, as a function of the clock.
 *
 * The requirements ask for this and call it the app's own idea: "Time-based features,
 * pushed to the top of the home screen between certain hours, after they drop into the
 * chronological feed." Three are named. A morning podcast, the evening Spotlight with
 * "Was zählt", and Mitmachen around lunchtime, which "has its own section the rest of
 * the time" — that last clause is the whole mechanism in one line. A module does not
 * appear and disappear; it moves.
 *
 * ## What this file no longer decides
 *
 * It used to name the module each daypart lifts (`WANTED`), the modules a host can
 * draw (`AVAILABLE`) and the answer composed from the two (`timedModuleAt`). All three
 * are `lib/home-layout.ts` now: a section in the home document carries `dayparts`, and
 * a module the host cannot draw is dropped by the parser with a report
 * ([ADR 0036](../../../../adr/0036-the-home-screen-becomes-data.md)). What is left here
 * is the clock, which is the only part of it that was never configuration.
 *
 * The morning podcast and the evening briefing have no section in that document, and
 * that is the same silence they had here. There is no morning podcast in the app, and
 * the evening slot wants Spotlight together with "Was zählt", a real podcast since
 * 22 June 2026 that is not connected. A gap we chose, know about and can read in
 * `SOURCES.md` is not a fault to report on every launch — ADR 0036 §7 draws exactly
 * that line — so the two stay out of the document rather than sitting in it as
 * sections nothing can draw.
 *
 * ## Why this is a pure function and not a store
 *
 * There is no state here, only the clock, and the clock is a parameter. A slice would
 * have to be told the time by something, and that something would be a timer nobody
 * cancels. A host asks on render and gets an answer, and `nextDaypartChange` tells it
 * when to ask again; a test hands it 07:30 and gets the morning without waiting for
 * one.
 *
 * Local hours on purpose. The reader's morning is the morning where the reader is, and
 * `Date.prototype.getHours` is the only thing in the platform that knows that.
 */

/** The named parts of a day, plus everything the requirements do not name. */
export type Daypart = 'morning' | 'midday' | 'evening' | 'off-hours';

/**
 * Every daypart as a value, so a document can be checked against the union at runtime.
 *
 * A `Record<Daypart, true>` rather than an array, because an array of four strings
 * agrees with the union without being complete: adding a fifth daypart to the type and
 * forgetting it here has to be a compile error, or `isDaypart` quietly starts calling a
 * real daypart unknown and the parser drops the sections that name it.
 */
const EVERY_DAYPART: Record<Daypart, true> = {
  morning: true,
  midday: true,
  evening: true,
  'off-hours': true,
};

export const DAYPARTS = Object.keys(EVERY_DAYPART) as readonly Daypart[];

/** Whether a value out of a document is one of the dayparts. */
export function isDaypart(value: unknown): value is Daypart {
  return typeof value === 'string' && Object.hasOwn(EVERY_DAYPART, value);
}

/**
 * The boundaries, inclusive of the first hour and exclusive of the last.
 *
 * Editorial numbers, not measured ones: nobody has said when the morning podcast drops
 * or when Spotlight is sent. They are here as one table rather than as conditions
 * inside the function, so moving them is an edit and not a rewrite, and so a reviewer
 * can argue with the numbers without reading the code.
 */
export const DAYPART_HOURS: Record<Exclude<Daypart, 'off-hours'>, readonly [number, number]> = {
  morning: [5, 10],
  midday: [11, 14],
  evening: [17, 22],
};

/**
 * Which part of the day a moment falls in.
 *
 * The ranges above must not overlap. This returns the FIRST match, so an overlap makes
 * the earlier key win silently and the later one simply never happen. Nothing in the
 * types prevents it and nothing at runtime complains, which is why there is a test
 * (`daypart.test.ts`) that reads the table and fails on an overlap: an editor moving
 * these numbers should be told, not left to find out from a screenshot.
 */
export function daypartAt(now: number | Date): Daypart {
  const hour = new Date(now).getHours();
  for (const [part, [from, to]] of Object.entries(DAYPART_HOURS)) {
    if (hour >= from && hour < to) return part as Daypart;
  }
  return 'off-hours';
}

/**
 * The next moment at which `daypartAt` changes its answer, as a timestamp.
 *
 * For a host that reads the clock on render. Home picks its sections when it renders,
 * and nothing re-renders a mounted tab on the hour, so without this the lifted block
 * moved on the next feed load or cold start rather than at the boundary. One timer to
 * this moment, cancelled with the screen, is what makes the screen agree with the
 * table. Local hours, like everything else here: `Date`'s local constructor absorbs a
 * daylight-saving shift on the day it happens.
 */
export function nextDaypartChange(now: number | Date): number {
  const at = new Date(now);
  const boundaries = [...new Set(Object.values(DAYPART_HOURS).flat())].sort((a, b) => a - b);
  for (const hour of boundaries) {
    const candidate = new Date(at.getFullYear(), at.getMonth(), at.getDate(), hour).getTime();
    if (candidate > at.getTime()) return candidate;
  }
  // Past today's last boundary: the first one tomorrow.
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, boundaries[0]!).getTime();
}
