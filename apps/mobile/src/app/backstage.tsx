import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Badge, Button, Card, Overline, ScreenHeader, SectionCard, Typo } from '@/components/ui';
import {
  clubNewsletter,
  diaries,
  earlyAccess,
  events,
  qa,
  verlagPerk,
  type DiaryEntry,
} from '@correctiv/app-core/data/backstage';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';
import { openArticle } from '@/lib/openArticle';
import { openExternal } from '@/lib/openExternal';
import { useColors } from '@/lib/theme';

/**
 * Backstage — early access, the research diary, the club letter, the Q&A, events,
 * the publishing house.
 *
 * Nothing here is locked, and that has not changed: the rule was and is that the club
 * is closeness rather than a paywall. What has gone is the second copy for a guest,
 * because since the door (ADR 0016) there is no guest to tease. Removed with ADR 0018.
 */
export default function BackstageScreen() {
  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Backstage" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Badge label="Club" tone="club" />
        <Typo variant="headline-xl" className="mt-s">
          Backstage
        </Typo>

        <SectionCard label="Früher lesen" labelColor="accent" className="mt-l">
          <Typo variant="headline-xs">{earlyAccess.title}</Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
            {earlyAccess.teaser}
          </Typo>
          <Typo variant="text-s" color="grey-500" className="mt-s">
            Öffentlich ab {earlyAccess.publicFromLabel}
          </Typo>
          <Button
            title="Jetzt lesen"
            className="mt-s"
            onPress={() => openArticle({ url: earlyAccess.articleUrl, title: earlyAccess.title })}
          />
        </SectionCard>

        <View className="mt-m">
          <Overline label="Recherchetagebuch" />
          <View className="mt-2xs">
            {diaries.map((entry) => (
              <DiaryRow key={entry.id} entry={entry} />
            ))}
          </View>
        </View>

        <SectionCard label="Backstage-Brief" tone="surface" className="mt-m">
          <Typo variant="headline-xs">{clubNewsletter.subject}</Typo>
          <Typo variant="text-s" color="grey-500" className="mt-4xs">
            {formatDateShortDe(clubNewsletter.date)}
          </Typo>
          {clubNewsletter.paragraphs.map((paragraph) => (
            <Typo key={paragraph.slice(0, 24)} variant="text-s" className="mt-s">
              {paragraph}
            </Typo>
          ))}
        </SectionCard>

        <SectionCard label="Fragerunde" className="mt-m">
          <Typo variant="headline-xs">{qa.title}</Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
            {qa.description}
          </Typo>
          <Typo variant="text-s" color="accent" className="mt-s">
            {qa.deadlineLabel}
          </Typo>
        </SectionCard>

        <View className="mt-m">
          <Overline label="Termine" />
          {events.map((event) => (
            <Card key={event.id} className="mt-2xs">
              <Typo variant="headline-xs">{event.title}</Typo>
              <Typo variant="text-s" color="grey-500" className="mt-4xs">
                {formatDateShortDe(event.date)} · {event.location}
              </Typo>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
                {event.description}
              </Typo>
            </Card>
          ))}
        </View>

        <SectionCard label="Verlag" tone="surface" className="mt-m">
          <Typo variant="headline-xs">{verlagPerk.title}</Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
            {verlagPerk.description}
          </Typo>
          <Button
            title="Zum Shop"
            variant="outline"
            className="mt-s"
            onPress={() => openExternal(verlagPerk.shopUrl)}
          />
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function DiaryRow({ entry }: { entry: DiaryEntry }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={entry.title}
      onPress={() => router.push({ pathname: '/tagebuch/[id]', params: { id: entry.id } })}
      className="flex-row items-center border-b border-stroke py-s active:opacity-70"
    >
      <View className="flex-1 pr-s">
        <Overline label={entry.series} />
        <Typo variant="text-m" weight="bold" className="mt-4xs">
          {entry.title}
        </Typo>
        <Typo variant="text-s" color="on-canvas-muted" numberOfLines={2} className="mt-4xs">
          {entry.teaser}
        </Typo>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors['grey-500']} />
    </Pressable>
  );
}
