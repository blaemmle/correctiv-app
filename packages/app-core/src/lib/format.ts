// Built once at module scope rather than per call, because nothing about them
// varies: one locale, one option bag, every time. This is not a speed claim —
// nobody has measured either shape, and ADR 0026 holds that "a performance
// recommendation stays a measurement task until a runtime problem is demonstrated".
// If that measurement is ever taken, the honest starting point is that the move to
// Intl raised the work per call rather than lowering it: formatDateWeekdayDe now
// makes two formatToParts() calls per list row where it made two array lookups.
const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const dayMonthYearFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayMonthFormatter = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });
const numberFormatter = new Intl.NumberFormat('de-DE');

/** The slice of `Intl.DateTimeFormat` the assembly below uses. Named so a test can
 * stand in for a runtime whose `formatToParts()` has a hole. */
interface PartFormatter {
  format(date: Date): string;
  formatToParts(date: Date): Intl.DateTimeFormatPart[];
}

type DateParts = Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

/** Pins one date string to the German pattern `assemble` spells out, reading the
 * fields by name out of `formatter.formatToParts()`. Assembling does not merely
 * order the fields, it discards whatever separators the locale data carries, and
 * that is the point: byte-identity with the tables this replaced is the goal, and a
 * pinned pattern cannot drift when CLDR changes its mind.
 *
 * `assemble` returns undefined when the runtime left a field out, and the
 * formatter's own `format()` answers instead. That case is not hypothetical:
 * Android's Hermes was measured and produces every field, iOS was never measured at
 * all and its Hermes is not backed by `android.icu`, and a German-looking
 * "12. Juni undefined" on screen is worse than the locale's own wording. */
export function assembleDateParts(
  formatter: PartFormatter,
  date: Date,
  assemble: (parts: DateParts) => string | undefined,
): string {
  const byType: DateParts = {};
  for (const part of formatter.formatToParts(date)) byType[part.type] = part.value;
  return assemble(byType) ?? formatter.format(date);
}

/** "12. Juni 2026" — day, a literal ". ", month, a space, year. */
function dayMonthYear(d: Date): string {
  return assembleDateParts(dayMonthYearFormatter, d, ({ day, month, year }) =>
    day && month && year ? `${day}. ${month} ${year}` : undefined,
  );
}

/** "Freitag, 12. Juni 2026" — home header date per the design draft */
export function formatDateWeekdayDe(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const weekday = assembleDateParts(weekdayFormatter, d, (parts) => parts.weekday);
  return `${weekday}, ${dayMonthYear(d)}`;
}

export function formatDateDe(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return dayMonthYear(d);
}

export function formatDateShortDe(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return assembleDateParts(dayMonthFormatter, d, ({ day, month }) =>
    day && month ? `${day}. ${month}` : undefined,
  );
}

export function formatTimeHm(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** "25 Min." — coarse episode length from seconds (podcast lists). */
export function formatMinutesDe(sec: number): string {
  return `${Math.max(1, Math.round(sec / 60))} Min.`;
}

/** Counts, with the German thousands dot: responses, reports, views. Every caller
 * passes a whole number, and that is the contract — this is a counter's formatter,
 * not a general-purpose one. It no longer refuses to round, though: the hand-rolled
 * grouping it replaced never touched a fraction, `Intl.NumberFormat` defaults to
 * three decimals, and 1234.5678 therefore reads "1.234,568". An average or a rate
 * wants its own formatter with the precision written down, not this one. */
export function formatNumberDe(n: number): string {
  return numberFormatter.format(n);
}
