import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Button, Card, Hairline, Overline, ScreenHeader, Typo } from '@/components/ui';
import { callouts } from '@correctiv/app-core/data/callouts';
import { formatNumberDe } from '@correctiv/app-core/lib/format';
import { useExtraCount, useHasSubmitted } from '@/lib/store/core';
import { useColors } from '@/lib/theme';

/** The callouts are fixed, so the static export can emit one file per slug. */
export function generateStaticParams(): { slug: string }[] {
  return callouts.map((callout) => ({ slug: callout.slug }));
}

/**
 * Callout detail: what it is about, who is asking, what happens to the data — and
 * only then the button into the form.
 *
 * "Wer fragt?" and "Was passiert mit Ihren Daten?" sit BEFORE the button on purpose,
 * and in plain words. For a callout, trust is part of the product, not fine print.
 */
export default function AufrufScreen() {
  const colors = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const callout = callouts.find((c) => c.slug === slug) ?? null;
  const extra = useExtraCount(slug ?? '');
  const submitted = useHasSubmitted(slug ?? '');

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Mitmach-Aufruf" />

      {!callout ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            Diesen Aufruf gibt es nicht
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
            {slug ? `Unbekannte Kennung „${slug}“.` : 'Es wurde keine Kennung übergeben.'}
          </Typo>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-m pt-m pb-l"
            showsVerticalScrollIndicator={false}
          >
            <Overline label="CrowdNewsroom" color="accent" />
            <Typo variant="headline-l" className="mt-2xs">
              {callout.title}
            </Typo>

            <View className="mt-s flex-row items-center">
              <Ionicons name="people-outline" size={16} color={colors['grey-500']} />
              <Typo variant="text-s" color="grey-500" className="ml-2xs">
                {formatNumberDe(callout.responseCount + extra)} Beiträge bisher
              </Typo>
            </View>

            {callout.intro.map((paragraph) => (
              <Typo key={paragraph.slice(0, 24)} variant="text-m" className="mt-s">
                {paragraph}
              </Typo>
            ))}

            <Card tone="surface" className="mt-m">
              <Typo variant="headline-xs">Wer fragt?</Typo>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
                {callout.whoAsks}
              </Typo>
              <Typo variant="headline-xs" className="mt-s">
                Was passiert mit Ihren Daten?
              </Typo>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
                {callout.dataUse}
              </Typo>
            </Card>

            {submitted && (
              <Typo variant="text-s" color="accent" className="mt-s">
                ✓ Sie haben bereits beigetragen, danke! Weitere Hinweise sind willkommen.
              </Typo>
            )}
          </ScrollView>

          <View className="bg-canvas">
            <Hairline />
            <View className="px-m py-s">
              <Button
                title={submitted ? 'Weiteren Hinweis geben' : 'Mitmachen'}
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
