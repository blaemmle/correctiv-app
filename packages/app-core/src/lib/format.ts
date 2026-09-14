// Built once at module scope: constructing an Intl.DateTimeFormat is the
// expensive part, and these run in list render paths.
const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'long' });
const dayMonthYearFormatter = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const dayMonthFormatter = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' });
const numberFormatter = new Intl.NumberFormat('de-DE');

/** Collapses formatToParts() output into type -> value, so callers pick fields by name. */
function partsByType(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const byType: Record<string, string> = {};
  for (const part of parts) byType[part.type] = part.value;
  return byType;
}

/** "12. Juni 2026" — day, a literal ". ", month, a space, year. Assembled from
 * parts rather than trusting the formatter's own concatenation, since the
 * option bag alone does not guarantee this order or the trailing period. */
function dayMonthYear(d: Date): string {
  const parts = partsByType(dayMonthYearFormatter.formatToParts(d));
  return `${parts.day}. ${parts.month} ${parts.year}`;
}

/** "Freitag, 12. Juni 2026" — home header date per the design draft */
export function formatDateWeekdayDe(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const weekday = partsByType(weekdayFormatter.formatToParts(d)).weekday;
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
  const parts = partsByType(dayMonthFormatter.formatToParts(d));
  return `${parts.day}. ${parts.month}`;
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

export function formatNumberDe(n: number): string {
  return numberFormatter.format(n);
}
