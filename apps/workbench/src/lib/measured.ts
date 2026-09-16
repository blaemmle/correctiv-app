/**
 * How old a hand-taken figure is, worked out in the reader's browser.
 *
 * Deliberately not at build time. A published page sits at its address for
 * months, and a build-time "2 days ago" is a lie the moment the third day
 * passes. The date in the manifest is a fact and does not move; the distance
 * from today to it is the part that has to be recomputed on every view.
 */
export function daysSince(iso: string): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.NaN;
  const today = new Date();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((now - then) / 86_400_000);
}

/** The age in words, for a sentence that already names the date. */
export function ageInWords(iso: string): string {
  const days = daysSince(iso);
  if (Number.isNaN(days) || days < 0) return 'date unknown';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/**
 * A quarter, because the article feeds publish weekly at best.
 *
 * A post count from three months ago is not a current one, and nothing on this
 * site can tell the reader that except the calendar.
 */
export const STALE_AFTER_DAYS = 90;

export function isStale(iso: string): boolean {
  const days = daysSince(iso);
  return !Number.isNaN(days) && days >= STALE_AFTER_DAYS;
}
