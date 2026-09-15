import { Ionicons } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';

import { Button, Hairline, ScreenHeader, Typo } from '@/components/ui';
import { atlasStats, demolitionEntries } from '@correctiv/app-core/data/abriss-atlas';
import { formatNumberDe } from '@correctiv/app-core/lib/format';
import { openExternal } from '@/lib/openExternal';
import { useColors } from '@/lib/theme';

/**
 * The demolition atlas — deliberately no more than a gesture in the concept: no
 * API, no map, a static crop plus the latest reports. Reporting happens on
 * abriss-atlas.de, and the button says so.
 */
export default function AtlasScreen() {
  const colors = useColors();
  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Abriss-Atlas" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Typo variant="headline-l">Abriss-Atlas</Typo>

        {/* A placeholder rather than a map. A real one would be another native
            module for a feature the concept does not ask for. */}
        <View
          className="mt-s items-center justify-center rounded-md bg-surface"
          style={{ height: 130 }}
        >
          <Ionicons name="location-outline" size={28} color={colors['grey-500']} />
          <Typo variant="text-s" color="grey-500" className="mt-2xs">
            Kartenausschnitt (statisch)
          </Typo>
        </View>

        <Typo variant="text-m" className="mt-s">
          {formatNumberDe(atlasStats.totalReports)} gemeldete Abrisse in {atlasStats.citiesCovered}{' '}
          Städten (DE/CH)
        </Typo>

        <Typo variant="headline-xs" className="mt-m">
          Zuletzt gemeldet
        </Typo>
        <View className="mt-2xs">
          {demolitionEntries.map((entry) => (
            <View key={entry.id}>
              <View className="flex-row items-center py-s">
                <Ionicons name="location-outline" size={18} color={colors['grey-500']} />
                <View className="ml-s flex-1">
                  <Typo variant="text-m">{entry.building}</Typo>
                  <Typo variant="text-s" color="grey-500" className="mt-4xs">
                    {entry.place} · {entry.year}
                  </Typo>
                </View>
                <Typo variant="text-s" color="grey-500">
                  {entry.status}
                </Typo>
              </View>
              <Hairline />
            </View>
          ))}
        </View>

        <Button
          title="Abriss melden auf abriss-atlas.de"
          className="mt-m"
          fullWidth
          onPress={() => openExternal(atlasStats.url)}
        />
      </ScrollView>
    </View>
  );
}
