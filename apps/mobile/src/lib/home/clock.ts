import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  minuteOfDay,
  nextMomentAfter,
  parseTimeOfDay,
  type HomeLayout,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';

/**
 * What time Home thinks it is, and the one place anything may tell it otherwise.
 *
 * The home document is a day now ([ADR 0039](../../../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md)):
 * a set of places and a list of moments, folded up to a minute of the local day. That
 * minute normally comes from the clock. The preview needs it to come from a control, or
 * it cannot show the evening at eleven in the morning, and an editor arranging the day
 * would be arranging it blind.
 *
 * ## Where the seam is, and why it is this one
 *
 * `sectionsAt(layout, minute)` — the minute is a **parameter of the selector**, so the
 * core has no clock in it at all and nothing has to be injected, stubbed or reset. What
 * is left is one question in the host: where does this screen get its minute. This file
 * is the answer, and it has exactly one door in it.
 *
 * That door is `localStorage`, for the reason `./layout.ts` gives at length about the
 * document: the workbench and the app are one origin, so the shell's `localStorage` IS
 * this app's; a write fires a `storage` event in every other same-origin document; and
 * it is the only seam that works against the **published export**, where `expo export`
 * has left no dev handle to dispatch through. The layout override already travels this
 * way, and a second mechanism for the second half of the same tool would be the one
 * nobody keeps in step.
 *
 * ## Why this is not a hole in a shipped app
 *
 * On iOS and Android there is no `localStorage`, so there is no key, and the guarded read
 * below answers `null` before it touches anything. **`window` is not what makes that
 * true**, and the guard would be a hole if it were: React Native defines one —
 * `react-native/Libraries/Core/setUpGlobals.js` sets `global.window = global` — so the
 * `typeof window === 'undefined'` half passes on a phone and it is the
 * `!window.localStorage` half that answers. `./layout.ts` next door says it that way
 * round about the same door.
 *
 * On the web target the key can be set — by the workbench, which is the point — and what
 * it can do is move the home screen to another hour of the SAME document. It selects
 * between states the document already describes; it cannot introduce one. That is a
 * strictly smaller power than `workbench:home-layout` next door, which can replace the
 * document outright, and it is spelled `workbench:` for the same reason issue #112 asks
 * of every key this tool writes: a screen that quietly differs from the repository is
 * worse than one that says who changed it.
 *
 * It is also not durable state that somebody can leave behind by accident, and it takes
 * two mechanisms rather than one to say so. The workbench holds the simulated time in the
 * **address** (`tm=18:30`) and writes this key from there, so a link without the
 * parameter clears it on arrival; and the page holding that address going away clears it
 * too, which is a tab closing rather than a route changing and was the half that was
 * missing. `apps/workbench/src/preview/home/clock.ts` is the other end and says which
 * event covers which.
 */
export const HOME_TIME_OVERRIDE_KEY = 'workbench:home-time';

/**
 * The simulated minute, or null when the app is on its own clock.
 *
 * Guarded rather than platform-split, like the document override beside it: React Native
 * has no `localStorage`, a browser with site data switched off throws on the accessor,
 * and both answer the same way here — nobody has said what time it is, so the clock
 * stands. A value that is not `HH:MM` is not a time either, and is the same answer: a
 * junk key must not freeze the home screen at some minute nobody can see.
 */
function simulatedMinute(): MinuteOfDay | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return parseTimeOfDay(window.localStorage.getItem(HOME_TIME_OVERRIDE_KEY));
  } catch {
    return null;
  }
}

/**
 * When the simulated minute changes, which on the web target is a `storage` event.
 *
 * The browser fires that event in every same-origin document **except** the one that
 * made the change, so a write from the workbench arrives here and a write from this app
 * would not. That asymmetry is exactly right: nothing in the app writes this key.
 *
 * A no-op everywhere else. React calls a subscriber's unsubscribe on unmount and is
 * given one either way.
 */
function subscribeToTime(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === HOME_TIME_OVERRIDE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/**
 * How long until the document's next moment, from a real instant, in milliseconds.
 *
 * `nextMomentAfter` answers with a minute of the DAY, so the arithmetic against a real
 * clock is here and only here. Local construction on purpose, the way the daypart timer
 * this replaces did it: `new Date(y, m, d, h, min)` absorbs a daylight-saving shift on
 * the day it happens, and a UTC offset computed by hand does not.
 *
 * Null when the document has no moments at all. A home screen that does not change
 * through the day needs no wake-up, and a timer armed for one is a timer that fires for
 * nothing once a day for ever.
 */
function msUntilNextMoment(layout: HomeLayout, now: number): number | null {
  const next = nextMomentAfter(layout, minuteOfDay(now));
  if (next === null) return null;

  const at = new Date(now);
  const today = new Date(
    at.getFullYear(),
    at.getMonth(),
    at.getDate(),
    Math.floor(next / 60),
    next % 60,
  ).getTime();
  if (today > now) return today - now;

  const tomorrow = new Date(
    at.getFullYear(),
    at.getMonth(),
    at.getDate() + 1,
    Math.floor(next / 60),
    next % 60,
  ).getTime();
  return tomorrow - now;
}

/**
 * The minute of the day Home draws, kept in step with whatever is deciding it.
 *
 * Reading `Date.now()` on render was the first version of this, on the theory that Home
 * re-renders often enough. It does not: a tab screen stays mounted, and it re-renders
 * when a feed lands, on a pull to refresh or on a theme change, none of which happens on
 * the hour. So the lifted block moved on the next cold start rather than at the moment
 * the document names, and the screen disagreed with the document for as long as nobody
 * touched it.
 *
 * One timer to the next moment, which React cancels with the screen. Not a slice and not
 * an interval: the document knows exactly when its answer changes, so there is one
 * wake-up per moment and nothing to poll. A device that sleeps through one fires the
 * timer on resume, which is the moment the screen is next seen.
 *
 * While a simulated time is set there is no timer at all, because the clock is not what
 * is deciding: an editor dragging along the day would otherwise have the screen jump
 * back to the real hour the first time a moment passed.
 */
export function useHomeMinute(layout: HomeLayout): MinuteOfDay {
  const simulated = useSyncExternalStore(subscribeToTime, simulatedMinute, () => null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (simulated !== null) return;
    const wait = msUntilNextMoment(layout, now);
    if (wait === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [layout, simulated, now]);

  return simulated ?? minuteOfDay(now);
}
