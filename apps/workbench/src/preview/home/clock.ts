import { formatTimeOfDay, parseTimeOfDay } from '@correctiv/app-core/lib/home-layout';

import { HOME_TIME_KEY } from './names';

/**
 * What time the framed app thinks it is, and the one place this tool says so.
 *
 * The other half is `apps/mobile/src/lib/home/clock.ts`, which is where the argument for
 * the seam lives in full: the shell and the app are one origin, so `window.localStorage`
 * here **is** the app's; a write fires a `storage` event in every other same-origin
 * document; the app subscribes and redraws without a reload; and it works against the
 * published export, where `expo export` has left no dev handle to dispatch through.
 *
 * ## Why the time lives in the address and this file only follows it
 *
 * `preview/state.ts` carries `tm=18:30` beside the device, the route and the appearance,
 * for ADR 0028's reason — a view of the app is a thing you send somebody — and because
 * of what it prevents. A simulated clock held only in storage is durable state nobody
 * can see: shut the tab at 23:00 and every later visit to the published demo opens on a
 * home screen stuck at eleven at night, with nothing on screen saying why. Held in the
 * address, an address that does not name a time **clears** it, which `apply` below does
 * by taking the key away rather than by leaving the last one standing.
 *
 * So there is exactly one writer and it writes on every render of the tool: what the
 * address says, or nothing at all.
 */

/**
 * Put the simulated time where the framed app will find it, or take it away.
 *
 * `null` is the app on its own clock, and it removes the key rather than writing a
 * value that happens to match the hour — a key that is written once and then agrees for
 * a while is a state nobody can see and nobody clears.
 */
export function apply(time: string | null): void {
  try {
    if (time === null) window.localStorage.removeItem(HOME_TIME_KEY);
    else window.localStorage.setItem(HOME_TIME_KEY, time);
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}

/** The minute the address is asking for, or null when it asks for nothing. */
export function minuteOf(time: string | null): number | null {
  return parseTimeOfDay(time);
}

/** A minute back into the address's spelling of it. */
export function timeOf(minute: number): string {
  return formatTimeOfDay(minute);
}
