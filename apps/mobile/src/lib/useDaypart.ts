import { useEffect, useState } from 'react';

import { daypartAt, nextDaypartChange, type Daypart } from '@correctiv/app-core/lib/daypart';

/**
 * What part of the day it is, kept in step with the clock.
 *
 * `daypartAt` is a pure function of a moment, and the moment has to come from
 * somewhere. Reading `Date.now()` on render was the first version, on the theory that
 * Home re-renders often enough. It does not: a tab screen stays mounted, and it
 * re-renders when a feed lands, on a pull to refresh or on a theme change, none of
 * which happens on the hour. So the lifted block moved on the next cold start rather
 * than at the boundary, and the screen disagreed with the table for as long as nobody
 * touched it.
 *
 * One timer to the next boundary, which React cancels with the screen. Not a slice and
 * not an interval: the core's table knows exactly when its answer changes, so there is
 * one wake-up per boundary and nothing to poll. A device that sleeps through the
 * boundary fires the timer on resume, which is the moment the screen is next seen.
 *
 * It answers with the daypart itself rather than with a module to lift, which is what
 * it used to do. Which sections a daypart carries is the home document's business now
 * (`@correctiv/app-core/lib/home-layout`), and a hook that knew both would be the third
 * place that had to agree with it.
 */
export function useDaypart(): Daypart {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextDaypartChange(now) - now));
    return () => clearTimeout(timer);
  }, [now]);

  return daypartAt(now);
}
