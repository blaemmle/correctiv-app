import { useEffect } from 'react';

import { ScreenHeaderBar } from './ScreenHeaderBar';
import type { ScreenHeaderProps } from './screenHeaderTypes';

/**
 * This screen's header, on web: the app's own drawn bar, unchanged, plus the
 * browser tab's title.
 *
 * **Web keeps the bar because nothing else draws one.** In
 * `react-native-screens`, `lib/module/components/ScreenStackHeaderConfig.web.js`
 * makes that component and every subview of it a bare `View`, and
 * `SearchBar.web.js` is `const SearchBar = View`. So the split is not a
 * preference between two good options here: it is the only half that draws
 * anything ([ADR 0030](../../../../../adr/0030-the-platforms-header-and-ours-on-web.md)).
 *
 * **And the title has to be set by hand, which was measured rather than
 * assumed.** react-navigation's own bridge from `options.title` to
 * `document.title` is switched off: `expo-router/build/ExpoRoot.js` hands its
 * `NavigationContainer` a hard-coded `documentTitle: { enabled: false }`.
 * `expo-router/head` is the path it leaves open, and it needs a `HelmetProvider`
 * the app does not mount. Neither reaches the static export either, because the
 * root shell renders `null` until the fonts and the store are ready and the
 * export therefore contains no screen at all — every page ships
 * `<title data-rh="true"></title>`, measured on 2026-09-14. So this effect is the
 * whole of it.
 *
 * The previous title is restored on unmount, which is what makes a stack behave:
 * pushing remembers what was there, popping puts it back. That is also why this
 * lives in the header rather than in the root layout — the header is mounted
 * exactly as long as the screen is.
 */
export function ScreenHeader({ title, backLabel, children }: ScreenHeaderProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return <ScreenHeaderBar backLabel={backLabel}>{children}</ScreenHeaderBar>;
}
