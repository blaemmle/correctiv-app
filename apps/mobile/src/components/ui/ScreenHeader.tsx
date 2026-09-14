import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { ScreenHeaderBar } from './ScreenHeaderBar';
import type { ScreenHeaderProps } from './screenHeaderTypes';
import { useColors } from '@/lib/theme';

/**
 * This screen's header, on iOS and Android: the platform's own stack header,
 * configured, rather than a bar this app draws.
 *
 * ~~Deliberately NOT a native stack header — the app sets `headerShown: false`
 * throughout and builds its own bars, so that iOS, Android and web show the same
 * brand.~~ That half is voided by
 * [ADR 0030](../../../../../adr/0030-the-platforms-header-and-ours-on-web.md),
 * which puts the platform's header on iOS and Android for the reason
 * [ADR 0013](../../../../../adr/0013-native-tabs-and-a-web-tab-bar-of-its-own.md)
 * gives one level down: the parts a user has already learned elsewhere are worth
 * more as the platform's than as ours. **A native header looks different on every
 * platform, and on web it does not appear at all** — that half stands, was
 * re-measured for 0030, and is why `ScreenHeader.web.tsx` keeps the drawn bar.
 *
 * What is configured here and not inherited: the colours, because they come from
 * `useColors()` and a palette cannot reach a native header through a class; and
 * the back label, because iOS falls back to the previous route's title and no
 * route in this app had one until now.
 */
export function ScreenHeader({ title, drawnBar, backLabel, children }: ScreenHeaderProps) {
  const colors = useColors();

  // Keyed on the values rather than rebuilt per render: `Stack.Screen` calls
  // `navigation.setOptions` whenever this object's identity changes, and the
  // search screen re-renders on every keystroke.
  const options = useMemo(
    () =>
      drawnBar
        ? { title }
        : {
            title,
            headerShown: true,
            // "Zurück", not the platform's default. On iOS that default is the
            // previous route's title, and the tab routes have none, so the back
            // control would read whatever the router calls them.
            headerBackTitle: 'Zurück',
            headerStyle: { backgroundColor: colors.canvas },
            headerTintColor: colors['on-canvas'],
            headerTitleStyle: { color: colors['on-canvas'] },
          },
    [colors, drawnBar, title],
  );

  return (
    <>
      <Stack.Screen options={options} />
      {/* The two named exceptions keep the bar here as well as on web; the props
          type is what makes a call site say so. */}
      {drawnBar ? <ScreenHeaderBar backLabel={backLabel}>{children}</ScreenHeaderBar> : null}
    </>
  );
}
