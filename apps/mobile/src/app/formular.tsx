import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { FormField } from '@/components/participate/FormField';
import { Button, Hairline, ScreenHeader, Typo } from '@/components/ui';
import { callouts, type CalloutComponent, type Callout } from '@correctiv/app-core/data/callouts';
import { formatNumberDe } from '@correctiv/app-core/lib/format';
import { useCoreActions, useExtraCount } from '@/lib/store/core';
import { sizes, useColors } from '@/lib/theme';

/**
 * The participation flow: a multi-step form following the callout's schema, then
 * the thank-you page.
 *
 * `?slug=` rather than a path parameter (`/aufruf/[slug]/formular`): the route then
 * exports as a single file and needs no nested `generateStaticParams`. The same
 * decision as for /artikel and /video.
 *
 * The thank-you page is a state of THIS route, not one of its own: it shows the
 * same counter it just raised, and going back must not drop the reader into the
 * filled-in form again.
 */
export default function FormularScreen() {
  const actions = useCoreActions();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const callout = useMemo(() => callouts.find((c) => c.slug === slug) ?? null, [slug]);

  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!callout) {
    return (
      <View className="flex-1 bg-canvas">
        <ScreenHeader title="Mitmach-Formular" drawnBar />
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            Dieses Formular gibt es nicht
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
            {slug ? `Unbekannter Aufruf „${slug}“.` : 'Es wurde kein Aufruf übergeben.'}
          </Typo>
        </View>
      </View>
    );
  }

  if (submitted) return <ThankYou callout={callout} />;

  const slides = callout.formSchema.slides;
  const slide = slides[Math.min(step, slides.length - 1)];
  const isLast = step === slides.length - 1;

  const select = (component: CalloutComponent, value: string) => {
    setChoices((prev) => {
      const current = prev[component.key] ?? [];
      if (component.type === 'radio') return { ...prev, [component.key]: [value] };
      return {
        ...prev,
        [component.key]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const stepValid = slide.components.every((component) => {
    if (!component.required) return true;
    if (component.type === 'radio' || component.type === 'selectboxes') {
      return (choices[component.key] ?? []).length > 0;
    }
    if (component.type === 'textarea' || component.type === 'textfield') {
      return (texts[component.key] ?? '').trim().length > 0;
    }
    return true;
  });

  const next = () => {
    if (!stepValid) return;
    if (!isLast) {
      setStep(step + 1);
      return;
    }
    actions.participation.submit(callout.slug, { ...choices, ...texts });
    setSubmitted(true);
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* The second named exception in ADR 0030. „Abbrechen“ exists so that two
          controls called „Zurück“ cannot mean two things, and `headerBackTitle`
          is iOS-only — an Android stack header shows no back title at all, so the
          label would simply disappear there. */}
      <ScreenHeader title="Mitmach-Formular" drawnBar backLabel="Abbrechen" />

      {/* Step indicator: one bar per slide, filled up to the current one. */}
      <View className="flex-row gap-3xs px-m pt-2xs">
        {slides.map((s, i) => (
          <View
            key={s.id}
            className={['flex-1 rounded-s', i <= step ? 'bg-accent' : 'bg-stroke'].join(' ')}
            style={{ height: sizes.progressBar }}
          />
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-s pb-l"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Typo variant="text-s" color="grey-500">
          Schritt {step + 1} von {slides.length}
        </Typo>
        <Typo variant="headline-l" className="mt-2xs">
          {slide.title}
        </Typo>

        {slide.components.map((component) => (
          <FormField
            key={component.key}
            component={component}
            choice={choices[component.key] ?? []}
            text={texts[component.key] ?? ''}
            fileAttached={files[component.key] ?? false}
            onSelect={(value) => select(component, value)}
            onText={(value) => setTexts((prev) => ({ ...prev, [component.key]: value }))}
            onToggleFile={() =>
              setFiles((prev) => ({ ...prev, [component.key]: !prev[component.key] }))
            }
          />
        ))}
      </ScrollView>

      <View className="bg-canvas">
        <Hairline />
        <View className="flex-row gap-s px-m py-s">
          {step > 0 && (
            <Button
              title="Zurück"
              variant="secondary"
              onPress={() => setStep(step - 1)}
              className="flex-1"
            />
          )}
          <Button
            title={isLast ? 'Absenden' : 'Weiter'}
            onPress={next}
            disabled={!stepValid}
            className="flex-1"
          />
        </View>
      </View>
    </View>
  );
}

/** The thank-you page, with the counter that already includes this submission. */
function ThankYou({ callout }: { callout: Callout }) {
  const colors = useColors();
  const extra = useExtraCount(callout.slug);

  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-1 items-center justify-center px-m">
        <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
        <Typo variant="headline-xl" className="mt-m text-center">
          Danke für Ihren Beitrag!
        </Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-s text-center">
          Ihr Beitrag fließt in die Recherche ein. Die Redaktion prüft alle Hinweise. Bei Rückfragen
          melden wir uns.
        </Typo>
        <Typo variant="headline-xs" className="mt-m text-center">
          {formatNumberDe(callout.responseCount + extra)} Menschen haben bereits beigetragen.
        </Typo>
      </View>
      <View className="px-m pb-l">
        <Button title="Weitere Mitmach-Aktionen ansehen" fullWidth onPress={backToOverview} />
      </View>
    </View>
  );
}

/**
 * Closes the callout page AND the form in one step — otherwise you land on the
 * detail page and have to go back a second time. `replace` is the fallback for when
 * nobody navigated here (a cold deep link straight into the form).
 */
function backToOverview(): void {
  if (router.canGoBack()) {
    router.dismissTo('/(tabs)/mitmachen');
    return;
  }
  router.replace('/(tabs)/mitmachen');
}
