import type { ReactNode } from 'react';
import { KeyboardAvoidingView } from 'react-native';

export type KeyboardAvoidingProps = {
  /**
   * The scroller, and anything pinned below it. Everything that has to stay above
   * the keyboard belongs in here rather than beside it — see below.
   */
  children: ReactNode;
  /** Classes for the avoiding view itself: it stands where a plain `View` would. */
  className?: string;
};

/**
 * The box that gets out of the software keyboard's way.
 *
 * Three screens take text input — the door, the participation form and search —
 * and this is the single place the decision behind all three lives.
 *
 * **`behavior="padding"` on both platforms**, and not the
 * `Platform.OS === 'ios' ? 'padding' : 'height'` this usually gets written as. The
 * reason is Android, and it is specific to how this app is built:
 *
 * - `app.json` sets no `android.softwareKeyboardLayoutMode`, so Expo's CNG writes
 *   `android:windowSoftInputMode="adjustResize"` onto the main activity. That was
 *   read out of a generated manifest, not assumed: `npx expo prebuild --platform
 *   android` and then `android/app/src/main/AndroidManifest.xml`.
 * - The attribute is inert here. The same prebuild writes `edgeToEdgeEnabled=true`
 *   into `gradle.properties`, and Expo's default `targetSdkVersion` is 36, so the
 *   window is laid out edge to edge — React Native calls
 *   `setDecorFitsSystemWindows(false)` — and Android never shrinks it for the
 *   keyboard. From Android 15 the platform ignores `adjustResize` regardless.
 * - So Android needs precisely the explicit avoidance iOS needs. The older advice,
 *   that on Android having the view is enough and `behavior` may be left off,
 *   describes a window that resizes itself. This one does not.
 *
 * React Native 0.86 is the first release where that actually works. It carries
 * facebook/react-native#55855, which rebuilt the Android keyboard events on
 * `WindowInsetsCompat` and stopped `keyboardDidHide` re-entering the measurement
 * with stale coordinates. On 0.85 this component would have moved nothing on
 * Android 15 and looped on `behavior="height"`.
 *
 * **It goes inside the safe area, never around it.** `padding` adds the overlap
 * between this view's own frame and the top of the keyboard. A bottom inset applied
 * outside it already lifts that frame, so the inset is subtracted from what this
 * adds and the two compose to exactly the keyboard's height. Wrapping the
 * `SafeAreaView` instead counts the inset twice, and the symptom is a gap that
 * reads as a layout bug rather than as too much padding.
 *
 * **The footer goes inside it, not beside it.** A footer that is a sibling of the
 * scroller reacts to the keyboard on its own and the two fight. Inside, one box
 * shrinks and both move together.
 *
 * `keyboardVerticalOffset` stays 0, and that is a measured fact about these three
 * screens rather than a default worth keeping: none of them sits under a native
 * stack header. The door is rendered in place of the whole route tree, and the form
 * and search draw the app's own bar. If one of them ever takes the platform's
 * header (ADR 0026, section 9) the offset it then needs is `useHeaderHeight()` from
 * `@react-navigation/elements`.
 *
 * On web this is a plain `View`: react-native-web's `KeyboardAvoidingView` drops
 * `behavior` and renders its children, because there the browser moves the page.
 * That is why there is no platform split here and the web layout is unchanged — one
 * more `<div>` carrying the same flex rules.
 */
export function KeyboardAvoiding({ children, className }: KeyboardAvoidingProps) {
  return (
    <KeyboardAvoidingView behavior="padding" className={className}>
      {children}
    </KeyboardAvoidingView>
  );
}
