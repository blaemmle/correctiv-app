import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Overline, ScreenHeader, Typo } from '@/components/ui';
import { diaries } from '@correctiv/app-core/data/backstage';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';

/** The diary entries are fixed — one file per entry in the static export. */
export function generateStaticParams(): { id: string }[] {
  return diaries.map((entry) => ({ id: entry.id }));
}

/** One research-diary entry: series, title, date, body copy. */
export default function TagebuchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = diaries.find((d) => d.id === id) ?? null;

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Recherchetagebuch" />

      {!entry ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            Diesen Eintrag gibt es nicht
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
          <Overline label={entry.series} color="accent" />
          <Typo variant="headline-l" className="mt-2xs">
            {entry.title}
          </Typo>
          <Typo variant="text-s" color="grey-500" className="mt-2xs">
            {formatDateShortDe(entry.date)}
          </Typo>

          {entry.body.map((paragraph) => (
            <Typo key={paragraph.slice(0, 24)} variant="text-article" className="mt-s">
              {paragraph}
            </Typo>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
