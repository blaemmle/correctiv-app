import { describe, expect, it } from 'vitest';
import {
  assembleDateParts,
  formatDateDe,
  formatDateShortDe,
  formatDateWeekdayDe,
  formatMinutesDe,
  formatNumberDe,
  formatTimeHm,
} from '../src/lib/format';

/**
 * These formatters lean on `Intl.DateTimeFormat` and `Intl.NumberFormat`. Two
 * separate measurements stand behind that, and neither covers the other:
 *
 * - Both constructors exist on `hermes-android 250829098.0.17` (arm64), the runtime
 *   this app ships on Android — ADR 0026, section 6, which measured which `Intl`
 *   constructors are present and says to confirm on a device, and on iOS separately.
 * - The German data itself came out of that confirmation: an Android 16 / API 36
 *   x86_64 emulator run on 2026-09-14, recorded in pull request #135.
 *
 * Node's own `Intl` is full ICU, though, so a pass here only proves the assembly
 * logic is right; it is not evidence the device produces the same bytes. iOS has
 * never been measured at all.
 */
describe('date formatting', () => {
  // Constructed in local time so the assertions do not depend on the TZ the
  // suite runs in (CI is UTC, Pascal's machine is CEST).
  const d = new Date(2026, 5, 12, 17, 20, 6); // 12 June 2026, a Friday

  it('formats a full German date', () => {
    expect(formatDateDe(d)).toBe('12. Juni 2026');
  });

  it('formats a German date with weekday', () => {
    expect(formatDateWeekdayDe(d)).toBe('Freitag, 12. Juni 2026');
  });

  it('formats a short German date', () => {
    expect(formatDateShortDe(d)).toBe('12. Juni');
  });

  it('accepts ISO strings', () => {
    expect(formatDateDe('2026-01-01T00:00:00')).toBe('1. Januar 2026');
    expect(formatDateShortDe('2026-12-31T12:00:00')).toBe('31. Dezember');
  });

  it('returns an empty string for unparseable input instead of "Invalid Date"', () => {
    expect(formatDateDe('nope')).toBe('');
    expect(formatDateWeekdayDe('')).toBe('');
    expect(formatDateShortDe('nope')).toBe('');
  });

  it('names every month, on both the long and the short formatter', () => {
    const months = [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ];
    months.forEach((name, index) => {
      const date = new Date(2026, index, 1);
      expect(formatDateDe(date)).toBe(`1. ${name} 2026`);
      expect(formatDateShortDe(date)).toBe(`1. ${name}`);
    });
  });

  it('names every weekday', () => {
    const weekdays = [
      'Sonntag',
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
    ];
    // 2026-06-07 is a Sunday, so the seven days from it cover every weekday once.
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(2026, 5, 7 + offset);
      expect(date.getDay()).toBe(offset);
      expect(formatDateWeekdayDe(date)).toBe(`${weekdays[offset]}, ${formatDateDe(date)}`);
    }
  });

  it('does not pad a single-digit day', () => {
    expect(formatDateDe(new Date(2026, 6, 5))).toBe('5. Juli 2026');
    expect(formatDateShortDe(new Date(2026, 6, 5))).toBe('5. Juli');
  });

  it('crosses a year boundary', () => {
    expect(formatDateDe(new Date(2026, 11, 31))).toBe('31. Dezember 2026');
    expect(formatDateDe(new Date(2027, 0, 1))).toBe('1. Januar 2027');
  });

  it('formats a leap day', () => {
    expect(formatDateDe(new Date(2028, 1, 29))).toBe('29. Februar 2028');
    expect(formatDateShortDe(new Date(2028, 1, 29))).toBe('29. Februar');
  });

  it('reads the day off the clock the device is on, not off a pinned zone', () => {
    // Every assertion above builds a local-time Date and CI runs in UTC, so a
    // formatter pinned to a fixed `timeZone` would pass all of them. These do not:
    // a pinned zone whose offset differs from the environment's pushes one end of
    // the local day into the neighbouring one. Both ends are asserted, because a
    // pin ahead of local moves the late one and a pin behind it moves the early one.
    expect(formatDateDe(new Date(2026, 5, 12, 0, 0, 0))).toBe('12. Juni 2026');
    expect(formatDateDe(new Date(2026, 5, 12, 23, 59, 59))).toBe('12. Juni 2026');
    expect(formatDateWeekdayDe(new Date(2026, 5, 12, 0, 0, 0))).toBe('Freitag, 12. Juni 2026');
    expect(formatDateWeekdayDe(new Date(2026, 5, 12, 23, 59, 59))).toBe('Freitag, 12. Juni 2026');
    expect(formatDateShortDe(new Date(2026, 5, 12, 0, 0, 0))).toBe('12. Juni');
    expect(formatDateShortDe(new Date(2026, 5, 12, 23, 59, 59))).toBe('12. Juni');
  });
});

describe('assembling a date from formatToParts()', () => {
  const d = new Date(2026, 5, 12, 17, 20, 6);
  const full = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  /** Stands in for a runtime whose `formatToParts()` names one field fewer than the
   * Android Hermes this was measured against. */
  const missing = (type: Intl.DateTimeFormatPartTypes) => ({
    format: (date: Date) => full.format(date),
    formatToParts: (date: Date) => full.formatToParts(date).filter((p) => p.type !== type),
  });
  const dayMonthYear = (parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>>) =>
    parts.day && parts.month && parts.year
      ? `${parts.day}. ${parts.month} ${parts.year}`
      : undefined;

  it('falls back to the formatter instead of rendering the word "undefined"', () => {
    expect(assembleDateParts(full, d, dayMonthYear)).toBe('12. Juni 2026');
    for (const type of ['day', 'month', 'year'] as const) {
      const assembled = assembleDateParts(missing(type), d, dayMonthYear);
      expect(assembled).not.toContain('undefined');
      expect(assembled).toBe(full.format(d));
    }
  });
});

describe('formatTimeHm', () => {
  it('renders player positions as m:ss', () => {
    expect(formatTimeHm(0)).toBe('0:00');
    expect(formatTimeHm(9)).toBe('0:09');
    expect(formatTimeHm(65)).toBe('1:05');
    expect(formatTimeHm(3600)).toBe('60:00');
  });

  it('truncates fractional seconds', () => {
    expect(formatTimeHm(59.9)).toBe('0:59');
  });
});

describe('formatMinutesDe', () => {
  it('rounds to whole minutes', () => {
    expect(formatMinutesDe(1500)).toBe('25 Min.');
    expect(formatMinutesDe(1530)).toBe('26 Min.');
  });

  it('never shows "0 Min." for a short clip', () => {
    expect(formatMinutesDe(0)).toBe('1 Min.');
    expect(formatMinutesDe(5)).toBe('1 Min.');
  });
});

describe('formatNumberDe', () => {
  it('groups thousands with a dot', () => {
    expect(formatNumberDe(1000)).toBe('1.000');
    expect(formatNumberDe(1234567)).toBe('1.234.567');
  });

  it('leaves small numbers alone', () => {
    expect(formatNumberDe(0)).toBe('0');
    expect(formatNumberDe(999)).toBe('999');
  });

  it('groups right at the thousands boundaries', () => {
    expect(formatNumberDe(999)).toBe('999');
    expect(formatNumberDe(1000)).toBe('1.000');
    expect(formatNumberDe(1001)).toBe('1.001');
    expect(formatNumberDe(9999)).toBe('9.999');
    expect(formatNumberDe(10000)).toBe('10.000');
    expect(formatNumberDe(999999)).toBe('999.999');
    expect(formatNumberDe(1000000)).toBe('1.000.000');
  });

  it('groups a negative number the same way, with the sign kept in front', () => {
    expect(formatNumberDe(-999)).toBe('-999');
    expect(formatNumberDe(-1000)).toBe('-1.000');
    expect(formatNumberDe(-1234567)).toBe('-1.234.567');
  });

  it('rounds a fraction at three decimals, where the grouping it replaced never rounded', () => {
    // Every caller passes a count, so this is not a case the app reaches today. It
    // is pinned because the contract moved silently: the regex this replaced left
    // the fraction alone, and the first caller to hand over an average would be
    // rounded past a green suite otherwise.
    expect(formatNumberDe(1234.5)).toBe('1.234,5');
    expect(formatNumberDe(1234.5678)).toBe('1.234,568');
  });
});
