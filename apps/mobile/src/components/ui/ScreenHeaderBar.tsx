import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Hairline } from './Hairline';
import { SafeAreaView } from './SafeAreaView';
import { Typo } from './Typo';
import { goBack } from '@/lib/navigation/goBack';
import { useColors } from '@/lib/theme';

export type ScreenHeaderBarProps = {
  /**
   * What back means. Left out: one step back, and home when there is no step back
   * — a deep link or a shared web address. Every screen used to pass its own
   * `router.back()`, and not one of them knew about that case; see
   * `lib/navigation/goBack.ts`.
   */
  onBack?: () => void;
  /** Label of the back control, and its accessibility name. */
  backLabel?: string;
  /**
   * Sits right of the back control. When something is set, back shrinks to the
   * chevron alone — otherwise the row does not fit.
   */
  children?: ReactNode;
};

/**
 * Back bar with a hairline, as in the design draft: chevron plus „Zurück“, no
 * title row.
 *
 * Not a screen's header on its own. `ScreenHeader` decides where this is drawn —
 * always on web, and on the two screens that keep it everywhere — and this file
 * is what all of those render, so there is one bar rather than three copies of
 * one. The gallery shows it under `ScreenHeader`, because on web that is exactly
 * what `ScreenHeader` draws.
 */
export function ScreenHeaderBar({ onBack, backLabel = 'Zurück', children }: ScreenHeaderBarProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={['top']} className="bg-canvas">
      <View className="flex-row items-center px-s py-2xs">
        <Pressable
          onPress={onBack ?? goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          className="flex-row items-center py-2xs active:opacity-60"
        >
          <Ionicons name="chevron-back" size={20} color={colors['on-canvas']} />
          {!children && (
            <Typo variant="text-m" weight="semibold" className="ml-4xs">
              {backLabel}
            </Typo>
          )}
        </Pressable>
        {children ? <View className="ml-2xs flex-1">{children}</View> : null}
      </View>
      <Hairline />
    </SafeAreaView>
  );
}
