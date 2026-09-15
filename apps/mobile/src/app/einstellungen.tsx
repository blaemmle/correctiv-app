import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SettingRow } from '@/components/profile/SettingRow';
import { Button, Hairline, ScreenHeader, SectionCard, Typo } from '@/components/ui';
import { openExternal } from '@/lib/openExternal';
import { useCoreActions, useSession, useSettings } from '@/lib/store/core';
import type { EntitlementSource } from '@correctiv/app-core/types/models';

/** Affects the article typography in the reader. */
const TEXT_SCALES = [
  { label: 'A', value: 0.9 },
  { label: 'A+', value: 1 },
  { label: 'A++', value: 1.15 },
];

const LINKS = [
  { title: 'correctiv.org öffnen', url: 'https://correctiv.org/ueber-uns/' },
  { title: 'Impressum', url: 'https://correctiv.org/impressum/' },
  { title: 'Datenschutz', url: 'https://correctiv.org/datenschutz/' },
];

/** Why the app is open to this account, as the membership system answered it. */
const ACCESS_SOURCE: Record<EntitlementSource, string> = {
  paid: 'Mitgliedschaft mit Beitrag',
  'local-bundle': 'Lokal-Bundle',
  trial: 'Testphase',
};

export default function EinstellungenScreen() {
  const actions = useCoreActions();
  const settings = useSettings();
  const session = useSession();
  const [resetDone, setResetDone] = useState(false);

  const followSystem = settings.theme === 'system';
  const accessLine = session.entitlement?.source
    ? ACCESS_SOURCE[session.entitlement.source]
    : 'Ohne App-Zugang';

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Einstellungen" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Typo variant="headline-l">Einstellungen</Typo>

        {/* The way back out of the door. Signing out closes the app in the same
            tick, because the root layout renders the gate in place of the routes. */}
        <SectionCard label="Konto" className="mt-m">
          <Typo variant="text-m" weight="semibold">
            {session.account?.email ?? 'Nicht angemeldet'}
          </Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-3xs">
            {accessLine}
          </Typo>
          <Button
            title="Abmelden"
            variant="outline"
            className="mt-s"
            fullWidth
            onPress={() => actions.session.signOut()}
          />
        </SectionCard>

        <SectionCard label="Benachrichtigungen" className="mt-m">
          <SettingRow
            label="Push-Mitteilungen"
            description="Neue Recherchen und Mitmach-Aufrufe (simuliert)"
            value={settings.pushOptIn}
            onValueChange={(value) => actions.settings.setPushOptIn(value)}
          />
        </SectionCard>

        <SectionCard label="Darstellung" className="mt-m">
          <SettingRow
            label="An Systemeinstellung orientieren"
            value={followSystem}
            onValueChange={(value) => actions.settings.setTheme(value ? 'system' : 'light')}
          />
          {!followSystem && (
            <>
              <Hairline className="my-2xs" />
              <SettingRow
                label="Dunkelmodus"
                value={settings.theme === 'dark'}
                onValueChange={(value) => actions.settings.setTheme(value ? 'dark' : 'light')}
              />
            </>
          )}
        </SectionCard>

        <SectionCard label="Textgröße im Artikel" className="mt-m">
          <View className="flex-row gap-s">
            {TEXT_SCALES.map((scale) => {
              const active = settings.textScale === scale.value;
              return (
                <Pressable
                  key={scale.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Textgröße ${scale.label}`}
                  onPress={() => actions.settings.setTextScale(scale.value)}
                  className={[
                    'flex-1 items-center rounded-md border py-s active:opacity-80',
                    active ? 'border-accent bg-surface' : 'border-stroke',
                  ].join(' ')}
                >
                  <Typo variant="text-m" weight={active ? 'bold' : 'normal'}>
                    {scale.label}
                  </Typo>
                </Pressable>
              );
            })}
          </View>
          <Typo variant="text-s" color="grey-500" className="mt-s">
            Wirkt sich auf die Artikel-Ansicht aus.
          </Typo>
        </SectionCard>

        <SectionCard label="Über CORRECTIV" className="mt-m">
          <Typo variant="text-m">
            CORRECTIV ist ein gemeinnütziges, unabhängiges Recherchezentrum. Recherchen für die
            Gesellschaft, finanziert von Menschen wie Ihnen.
          </Typo>
          {LINKS.map((link) => (
            <Button
              key={link.url}
              title={link.title}
              variant="outline"
              onPress={() => openExternal(link.url)}
              className="mt-s"
              fullWidth
            />
          ))}
        </SectionCard>

        <SectionCard label="Demo" tone="surface" className="mt-m">
          <Typo variant="text-s" color="on-canvas-muted">
            Für Vorführungen: setzt Interessen und Onboarding zurück. Ihr Konto bleibt angemeldet.
          </Typo>
          <Button
            title="Demo-Zustand zurücksetzen"
            variant="secondary"
            className="mt-s"
            fullWidth
            onPress={() => {
              // Two stores, because each owns its own keys — see resetForDemo. It
              // was three until the membership slice went (ADR 0020).
              actions.settings.resetForDemo();
              actions.interests.clear();
              setResetDone(true);
            }}
          />
          {resetDone && (
            <Typo variant="text-s" color="accent" className="mt-s">
              ✓ Zurückgesetzt. App neu starten für das Onboarding.
            </Typo>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}
