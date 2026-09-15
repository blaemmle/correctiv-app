import { Pressable, View } from 'react-native';

import { Typo } from './Typo';

export type SectionHeaderProps = {
  title: string;
  /** Optional "more" link on the right. The words only; the arrow is this file's. */
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/**
 * Section heading with an optional action link on the right (e.g. "Alles aus dem
 * Backstage →").
 *
 * **The arrow is drawn here and is not part of `actionLabel`.** It is decoration
 * on a link, so it belongs to whoever draws the link rather than to the words, and
 * that settles two things at once: a translator is never handed a glyph to carry,
 * and the accessibility name is the sentence without it, so a screen reader says
 * the words instead of "right arrow". The three cards on Home that draw their own
 * link — `SpotlightBriefing`, `BackstageTeaser`, `EarlyAccessCard` — put it beside
 * the message in their markup for exactly that reason; here the markup is this
 * file's, so the arrow is too. It used to arrive glued to the label in a template
 * literal at two call sites on Home, which is the same decoration in the one place
 * it could not be told apart from the copy.
 */
export function SectionHeader({ title, actionLabel, onAction, className }: SectionHeaderProps) {
  return (
    <View className={['flex-row items-end justify-between', className ?? ''].join(' ')}>
      <Typo variant="headline-m">{title}</Typo>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={actionLabel}
          className="active:opacity-60"
        >
          <Typo variant="text-s" color="accent">
            {actionLabel} →
          </Typo>
        </Pressable>
      ) : null}
    </View>
  );
}
