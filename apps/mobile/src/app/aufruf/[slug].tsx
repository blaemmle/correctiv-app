import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { ScrollView, View } from 'react-native';

import { Button, Card, Hairline, Overline, ScreenHeader, Typo } from '@/components/ui';
import { callouts } from '@correctiv/app-core/data/callouts';
import { useExtraCount, useHasSubmitted } from '@/lib/store/core';
import { useColors } from '@/lib/theme';

/** The callouts are fixed, so the static export can emit one file per slug. */
export function generateStaticParams(): { slug: string }[] {
  return callouts.map((callout) => ({ slug: callout.slug }));
}

/**
 * Everything a person reads on this screen, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/callout.ts`.
 *
 * This screen states CrowdNewsroom outright for every callout, survey included,
 * so it has words of its own rather than `lib/participate/calloutStyle.ts`'s: that
 * function answers for the card and the home teaser, which is what its own comment
 * says, and the migration is not the place to change what a third screen shows.
 *
 * The quotation marks around a slug sit INSIDE the message. German quotes them
 * low-then-high and English does not, so the marks are part of the sentence and
 * belong with the language rather than in the markup.
 */
const COPY = defineMessages({
  unknownHeadline: {
    id: 'callout.detail.unknownHeadline',
    defaultMessage: 'This callout does not exist',
  },
  unknownSlug: { id: 'callout.detail.unknownSlug', defaultMessage: 'Unknown identifier "{slug}".' },
  noSlug: { id: 'callout.detail.noSlug', defaultMessage: 'No identifier was given.' },
  responses: {
    id: 'callout.detail.responses',
    defaultMessage:
      '{count, plural, one {One contribution} other {{count, number} contributions}} so far',
  },
  whoAsks: { id: 'callout.detail.whoAsks', defaultMessage: 'Who is asking?' },
  dataUse: { id: 'callout.detail.dataUse', defaultMessage: 'What happens to your data?' },
  contributed: {
    id: 'callout.detail.contributed',
    defaultMessage: '✓ You have contributed already, thank you! More tips are welcome.',
  },
  cta: { id: 'callout.detail.cta', defaultMessage: 'Take part' },
  contributeAgain: { id: 'callout.contributeAgain', defaultMessage: 'Send another tip' },
  screenTitle: { id: 'callout.screenTitle', defaultMessage: 'Callout' },
});

/** The product's name, the same in every language, so it carries no id. */
const CROWDNEWSROOM = 'CrowdNewsroom';

/**
 * Callout detail: what it is about, who is asking, what happens to the data — and
 * only then the button into the form.
 *
 * `whoAsks` and `dataUse` sit BEFORE the button on purpose, and in plain words.
 * For a callout, trust is part of the product, not fine print.
 */
export default function AufrufScreen() {
  const intl = useIntl();
  const colors = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const callout = callouts.find((c) => c.slug === slug) ?? null;
  const extra = useExtraCount(slug ?? '');
  const submitted = useHasSubmitted(slug ?? '');

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />

      {!callout ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            {intl.formatMessage(COPY.unknownHeadline)}
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
            {slug
              ? intl.formatMessage(COPY.unknownSlug, { slug })
              : intl.formatMessage(COPY.noSlug)}
          </Typo>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-m pt-m pb-l"
            showsVerticalScrollIndicator={false}
          >
            <Overline label={CROWDNEWSROOM} color="accent" />
            <Typo variant="headline-l" className="mt-2xs">
              {callout.title}
            </Typo>

            <View className="mt-s flex-row items-center">
              <Ionicons name="people-outline" size={16} color={colors['grey-500']} />
              <Typo variant="text-s" color="grey-500" className="ml-2xs">
                {intl.formatMessage(COPY.responses, { count: callout.responseCount + extra })}
              </Typo>
            </View>

            {callout.intro.map((paragraph) => (
              <Typo key={paragraph.slice(0, 24)} variant="text-m" className="mt-s">
                {paragraph}
              </Typo>
            ))}

            <Card tone="surface" className="mt-m">
              <Typo variant="headline-xs">{intl.formatMessage(COPY.whoAsks)}</Typo>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
                {callout.whoAsks}
              </Typo>
              <Typo variant="headline-xs" className="mt-s">
                {intl.formatMessage(COPY.dataUse)}
              </Typo>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
                {callout.dataUse}
              </Typo>
            </Card>

            {submitted && (
              <Typo variant="text-s" color="accent" className="mt-s">
                {intl.formatMessage(COPY.contributed)}
              </Typo>
            )}
          </ScrollView>

          <View className="bg-canvas">
            <Hairline />
            <View className="px-m py-s">
              <Button
                title={intl.formatMessage(submitted ? COPY.contributeAgain : COPY.cta)}
                fullWidth
                onPress={() =>
                  router.push({ pathname: '/formular', params: { slug: callout.slug } })
                }
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}
