import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SettingRow } from '@/components/profile/SettingRow';
import { Button, Card, Chip, SafeAreaView, Typo } from '@/components/ui';
import { interests } from '@correctiv/app-core/data/interests';
import { useCoreActions, useSelectedInterests, useSettings } from '@/lib/store/core';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';
import { useColors } from '@/lib/theme';

/**
 * The sentences on the red mission screen.
 *
 * There was a third, "Ohne Paywall: Journalismus für alle". It became false with the
 * door (ADR 0016) and the login wall the scope puts on correctiv.org, so it is gone
 * rather than reworded: what takes its place is a claim about the new arrangement,
 * and that wording is CORRECTIV's to write, not this repo's. Removed with ADR 0018.
 */
const MISSION = ['Gemeinnützig: uns gehört niemand', 'Spendenfinanziert: von Tausenden getragen'];

/**
 * Onboarding: mission → interests → participate/push.
 *
 * There was a fourth step, the club pitch, ending in "Unterstützer:in werden" beside
 * "Erstmal umsehen". Both addressed someone who had not paid, and behind the door
 * (ADR 0016) nobody here is that person: they paid to get this far, and "erstmal
 * umsehen" was the thing they could no longer do. The step is gone with ADR 0018.
 *
 * "Überspringen" stays from step 2 on, and `completeOnboarding()` runs either way,
 * so skipping does not mean being asked again on the next launch.
 *
 * The mission screen is brand red and therefore independent of the colour scheme;
 * the steps after it run on the normal surface.
 */
export default function OnboardingScreen() {
  // The one title in the app that is not a word on the screen under it: these
  // three steps have three headings and no name. ADR 0030 names it as such.
  useDocumentTitle('Willkommen');
  const actions = useCoreActions();
  const colors = useColors();
  const [step, setStep] = useState(0);
  const settings = useSettings();
  const selected = useSelectedInterests();
  const selectedIds = new Set(selected.map((interest) => interest.id));

  const finish = () => {
    actions.settings.completeOnboarding();
    router.replace('/(tabs)');
  };

  const mission = step === 0;

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className={mission ? 'flex-1 bg-accent' : 'flex-1 bg-canvas'}
    >
      <View className="flex-row items-center justify-between px-m py-s">
        <View className="flex-row gap-2xs">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="rounded-full"
              style={{
                width: 7,
                height: 7,
                backgroundColor: mission
                  ? i === step
                    ? colors['always-light']
                    : 'rgba(255,255,255,0.45)'
                  : i === step
                    ? colors.accent
                    : colors['stroke'],
              }}
            />
          ))}
        </View>
        {step > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Überspringen"
            onPress={finish}
            hitSlop={8}
            className="active:opacity-70"
          >
            <Typo variant="text-s" color="on-canvas-muted">
              Überspringen
            </Typo>
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        // The mission screen has nothing to scroll, so its block is anchored to the
        // bottom of the viewport, which is where the design draft puts it.
        // Top-aligning it left a screen-height of empty red below.
        contentContainerClassName={mission ? 'px-m pb-l grow justify-end' : 'px-m pt-m pb-l'}
        showsVerticalScrollIndicator={false}
      >
        {mission && (
          <View>
            <Typo variant="headline-m" color="always-light" style={{ letterSpacing: 2 }}>
              CORRECTIV
            </Typo>
            {/* Merriweather, like the reader's h1: this is an editorial promise, not
                a UI label. Sans here was an Expo-only divergence. */}
            <Typo variant="headline-xxl" family="serif" color="always-light" className="mt-s">
              Recherchen für die Gesellschaft
            </Typo>
            <View className="mt-2xl">
              {MISSION.map((line) => (
                <View key={line} className="mt-s flex-row items-start">
                  {/* White, like the text beside it. The draft had these yellow,
                      but yellow is the club's colour and on the brand red it reads
                      as a colour accident rather than as a list marker. */}
                  <View
                    className="rounded-full bg-always-light"
                    style={{ width: 8, height: 8, marginTop: 7 }}
                  />
                  <Typo variant="text-l" color="always-light" className="ml-s flex-1">
                    {line}
                  </Typo>
                </View>
              ))}
            </View>
          </View>
        )}

        {step === 1 && (
          <>
            <Typo variant="headline-xl">Was interessiert Sie?</Typo>
            <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
              Ihre Auswahl ordnet die Startseite.
            </Typo>
            <View className="mt-m flex-row flex-wrap gap-2xs">
              {interests.map((interest) => (
                <Chip
                  key={interest.id}
                  label={interest.label}
                  selected={selectedIds.has(interest.id)}
                  onPress={() => actions.interests.toggle(interest.id)}
                />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Typo variant="headline-xl">Recherchen, bei denen Sie mitmachen</Typo>
            <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
              Im CrowdNewsroom tragen tausende Menschen zu Recherchen bei. Im Faktenforum prüft die
              Community Behauptungen. Beides finden Sie im Tab „Mitmachen“.
            </Typo>
            <Card className="mt-m">
              <SettingRow
                label="Benachrichtigungen"
                description="Bei neuen Recherchen und Mitmach-Aufrufen (simuliert)"
                value={settings.pushOptIn}
                onValueChange={(value) => actions.settings.setPushOptIn(value)}
              />
            </Card>
          </>
        )}
      </ScrollView>

      <View className="px-m pb-m">
        <Button
          title={step === 0 ? 'Los geht’s' : step === 2 ? 'Fertig' : 'Weiter'}
          variant={mission ? 'onEmphasis' : 'primary'}
          fullWidth
          onPress={() => (step === 2 ? finish() : setStep(step + 1))}
        />
      </View>
    </SafeAreaView>
  );
}
