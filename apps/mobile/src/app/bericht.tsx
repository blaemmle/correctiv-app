import { ScrollView, View } from 'react-native';

import { Badge, ScreenHeader, Typo } from '@/components/ui';
import { quarterlyReport } from '@correctiv/app-core/data/quartalsbericht';

/**
 * The quarterly report — transparency as club content, but without a barrier:
 * whoever opens the page sees it. The figures are sample data drawn from real
 * CORRECTIV transparency material (see data/quartalsbericht.ts).
 */
export default function BerichtScreen() {
  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Quartalsbericht" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Badge label="Club" tone="club" />
        <Typo variant="headline-xl" className="mt-s">
          {quarterlyReport.quarter}
        </Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
          {quarterlyReport.intro}
        </Typo>

        {quarterlyReport.sections.map((section) => (
          <View key={section.heading} className="mt-l">
            <Typo variant="headline-m">{section.heading}</Typo>
            <Typo variant="text-m" className="mt-2xs">
              {section.text}
            </Typo>
            {(section.figures ?? []).map((figure) => (
              <View key={figure.label} className="mt-s flex-row items-baseline">
                <Typo variant="headline-s" color="accent" style={{ minWidth: 64 }}>
                  {figure.value}
                </Typo>
                <Typo variant="text-s" color="on-canvas-muted" className="flex-1">
                  {figure.label}
                </Typo>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
