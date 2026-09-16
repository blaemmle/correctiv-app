import { Text, type TextProps } from 'react-native';

import {
  typography,
  typoFamily,
  typoWeight,
  fontFamilyFor,
  useColors,
  type FontFamily,
  type FontWeightName,
  type TypoVariant,
  type ColorToken,
} from '@/lib/theme';

export type TypoProps = TextProps & {
  /** Composite variant from typography.css: typeface, size, tracking, line height. */
  variant?: TypoVariant;
  /**
   * Colour token; defaults to `on-canvas`, the brand's body-text colour — which is
   * near-white in dark mode, because `on-canvas` names the role and not the value.
   *
   * On a surface whose colour does NOT follow the scheme — the brand red, club
   * yellow, a photograph — that flip is wrong, and a primitive is the answer:
   * `white` and `neutral-700` are the same colour in both schemes, because a
   * primitive names a value. (`always-light` and `always-dark` are the older names
   * for those two and still resolve; ADR 0022 retires them.)
   */
  color?: ColorToken;
  /**
   * Overrides the weight only; the family and the metrics stay. typography.css
   * treats weight as its own axis (`ty-text-m font-sans-semibold`) — exactly the
   * combination list titles need.
   */
  weight?: FontWeightName;
  /**
   * Overrides the family only; the metrics stay. The same separate axis as
   * `weight`: the mission screen and the reader set a headline in Merriweather,
   * which no single variant provides — and inventing a `display` variant would
   * break this file's 1:1 mirroring of typography.css.
   */
  family?: FontFamily;
  /** Utility classes for layout and spacing, not for typography. */
  className?: string;
};

/**
 * The canonical text component. The variant decides typeface, size and line
 * height, `color` the colour token, `className` the layout. That keeps typography
 * true to the tokens and independent of Android's fontWeight behaviour.
 */
export function Typo({
  variant = 'text-m',
  color = 'on-canvas',
  weight,
  family,
  style,
  className,
  ...rest
}: TypoProps) {
  const colors = useColors();
  // Either axis alone falls back to the variant's own value for the other one.
  const override =
    weight || family
      ? {
          fontFamily: fontFamilyFor(family ?? typoFamily[variant], weight ?? typoWeight[variant]),
        }
      : null;
  return (
    <Text
      className={className}
      /*
       * German compounds are longer than the lines a phone draws, and a word that
       * does not fit is broken somewhere whatever we say. Off — which is Android's
       * default — it is broken wherever the line happens to end and no hyphen is
       * printed, which is how Home's teaser read "Gebäud / emodernisierungsgesetz"
       * at 200 % system font (#158). `normal` hands the break to Android's own
       * hyphenator, which knows where a German word may be divided and marks it.
       *
       * **Not on a headline**, and that line was measured rather than preferred.
       * Hyphenation does not know about the font scale, so switching it on for
       * everything changes 100 % as well. Shot on the emulator before and after:
       * every screen whose words are the app's own came back identical — the gate,
       * both onboarding steps, Entdecken, the settings — at 0.7 % RMSE, which is
       * the clock in the status bar. The one thing that moved was a live headline,
       * which divided as "Abgeord-netenhaus" where it had wrapped whole. German
       * headlines are not hyphenated, and #158 asks for the 200 % defect to be
       * fixed without changing 100 %, so the rule stops at the display sizes.
       *
       * What that leaves standing: a headline holding a single word longer than the
       * line still breaks without a hyphen at 200 %. There is no such headline in
       * the app's own copy, and a feed could carry one.
       *
       * Android only — the prop's own name says so, and there is no iOS or web
       * equivalent to keep in step.
       *
       * Before `{...rest}`, so a caller can still turn it off for a line that must
       * not be divided.
       */
      android_hyphenationFrequency={variant.startsWith('headline') ? 'none' : 'normal'}
      style={[typography[variant], override, { color: colors[color] }, style]}
      {...rest}
    />
  );
}
