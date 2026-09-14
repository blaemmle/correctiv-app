import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { ClaimStatusTag } from '@/components/participate/ClaimStatusTag';
import { Button, Card, ScreenHeader, Typo } from '@/components/ui';
import { claims, type Claim, type ClaimSource } from '@correctiv/app-core/data/claims';
import { openExternal } from '@/lib/openExternal';

const FORUM_URL = 'https://faktenforum.org';

/** The claims are fixed, so one file per id in the static export. */
export function generateStaticParams(): { id: string }[] {
  return claims.map((claim) => ({ id: claim.id }));
}

/** How far along the check is: submitted → being checked → checked. */
const STAGES = ['Eingereicht', 'In Prüfung', 'Geprüft'] as const;

function stageOf(claim: Claim): number {
  return claim.status === 'checked' ? 2 : claim.status === 'checking' ? 1 : 0;
}

/** Reliability as a dot — full, half, empty. */
function credibilityDot(level: ClaimSource['credibility']): string {
  return level === 'hoch' ? '●' : level === 'mittel' ? '◐' : '○';
}

export default function BehauptungScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const claim = (claims.find((c) => c.id === id) ?? null) as Claim | null;

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Behauptung" />

      {!claim ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            Diese Behauptung gibt es nicht
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
            {id ? `Unbekannte Kennung „${id}“.` : 'Es wurde keine Kennung übergeben.'}
          </Typo>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-m pt-m pb-2xl"
          showsVerticalScrollIndicator={false}
        >
          <ClaimStatusTag claim={claim} />
          <Typo variant="headline-m" className="mt-s">
            „{claim.quote}“
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
            {claim.synopsis}
          </Typo>

          <ReviewProgress stage={stageOf(claim)} />

          <Typo variant="headline-xs" className="mt-m">
            Quellenbewertung
          </Typo>
          {claim.sources.length === 0 ? (
            <Card tone="surface" className="mt-s">
              <Typo variant="text-s" color="on-canvas-muted">
                Noch keine Quellen. Die Community sammelt.
              </Typo>
            </Card>
          ) : (
            claim.sources.map((source) => (
              <Pressable
                key={source.url}
                accessibilityRole="link"
                accessibilityLabel={source.note ?? source.url}
                onPress={() => openExternal(source.url)}
                className="mt-s active:opacity-80"
              >
                <Card className="flex-row">
                  <Typo variant="text-m">{credibilityDot(source.credibility)}</Typo>
                  <View className="ml-s flex-1">
                    <Typo variant="text-m">{source.note ?? source.url}</Typo>
                    <Typo variant="text-s" color="grey-500" className="mt-4xs">
                      Verlässlichkeit: {source.credibility}
                    </Typo>
                  </View>
                </Card>
              </Pressable>
            ))
          )}

          <Button
            title="Eigenen Hinweis einreichen (im Faktenforum)"
            variant="outline"
            className="mt-m"
            onPress={() => openExternal(FORUM_URL)}
          />
        </ScrollView>
      )}
    </View>
  );
}

/** Three dots joined by lines, filled up to the stage reached. */
function ReviewProgress({ stage }: { stage: number }) {
  return (
    <View className="mt-m flex-row items-start">
      {STAGES.map((label, i) => (
        <View key={label} className="flex-1 flex-row items-start">
          {i > 0 && (
            <View
              className={['flex-1 self-start', i <= stage ? 'bg-accent' : 'bg-stroke'].join(' ')}
              style={{ height: 2, marginTop: 5 }}
            />
          )}
          <View className="items-center px-2xs">
            <View
              className={[
                'rounded-full',
                i <= stage ? 'bg-accent' : 'border border-stroke bg-canvas',
              ].join(' ')}
              style={{ width: 12, height: 12 }}
            />
            <Typo
              variant="text-s"
              color={i <= stage ? 'on-canvas' : 'grey-500'}
              className="mt-3xs text-center"
              style={{ fontSize: 11 }}
            >
              {label}
            </Typo>
          </View>
        </View>
      ))}
    </View>
  );
}
