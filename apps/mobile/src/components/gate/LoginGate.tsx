import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';

import { KeyboardAvoiding } from '@/components/keyboard/KeyboardAvoiding';
import { Button, Card, Hairline, Overline, SafeAreaView, Typo } from '@/components/ui';
import { formatDateDe } from '@correctiv/app-core/lib/format';
import type { SignInFailure } from '@correctiv/app-core/services/auth.service';
import { accessShortfall, type AccessShortfall } from '@correctiv/app-core/stores/session';
import { TIER_LABELS } from '@/lib/membership/tierLabel';
import { openExternal } from '@/lib/openExternal';
import { useCoreActions, useSession } from '@/lib/store/core';
import { typography, useColors } from '@/lib/theme';

/**
 * Everything a person reads on the door, in one place.
 *
 * The fourth block is the one that was written most carefully. It is shown to
 * someone who IS a member, has just signed in, and is told the app is not part of
 * what they have. That is not an error and must not read like one: it thanks, it
 * says what the 0 € membership does cover, it says what the contribution is for,
 * and it offers the way in.
 */
const COPY = {
  wordmark: 'CORRECTIV',
  form: {
    headline: 'Für alle, die CORRECTIV tragen.',
    lead: 'Diese App ist der Ort für Mitglieder mit Beitrag. Ihr Konto ist dasselbe wie auf correctiv.org.',
    emailHeading: 'E-Mail',
    emailLabel: 'E-Mail-Adresse',
    emailPlaceholder: 'name@beispiel.de',
    passwordHeading: 'Passwort',
    passwordLabel: 'Passwort eingeben',
    passwordPlaceholder: 'Ihr Passwort',
    submit: 'Anmelden',
    checking: 'Wir prüfen Ihre Mitgliedschaft …',
    forgot: 'Passwort vergessen?',
    join: 'Mitglied mit Beitrag werden',
    failure: {
      'wrong-credentials': 'E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie beides.',
      unreachable:
        'correctiv.org ist gerade nicht erreichbar. Bitte versuchen Sie es in ein paar Minuten noch einmal.',
    } satisfies Record<SignInFailure, string>,
    simulated:
      'Es wird nichts übertragen. Jede Adresse meldet an: mit „frei“ als kostenlose Stufe ohne App-Zugang, mit „test“ in der Testphase, mit „lokal“ über das Lokal-Bundle. Ein Passwort unter vier Zeichen schlägt fehl.',
  },
  noAccess: {
    signedInAs: (email: string) => `Angemeldet als ${email}`,
    headline: 'Schön, dass Sie dabei sind.',
    lead: 'Die App gehört zur Mitgliedschaft mit Beitrag.',
    tier: 'Ihr Konto hat die kostenlose Stufe. Damit lesen Sie weiter alles auf correctiv.org. Die App kommt mit dem Beitrag dazu: Er finanziert die Recherchen, und dafür gibt es hier Audio, Video und Formate, die es nur in der App gibt.',
    lapsed: (date: string) =>
      `Ihre Testphase ist am ${date} zu Ende gegangen. Danke, dass Sie die App ausprobiert haben. Mit einem Beitrag geht es hier weiter, mit allem, was Sie schon kennen.`,
    tierRow: 'Ihre Stufe',
    tierTrial: 'Testphase',
    accessRow: 'App-Zugang',
    accessNone: 'Nicht enthalten',
    accessLapsed: (date: string) => `Testphase, beendet am ${date}`,
    upgrade: 'Mitgliedschaft erweitern',
    resume: 'Beitrag festlegen',
    recheck: 'Erneut prüfen',
    switchAccount: 'Mit einem anderen Konto anmelden',
    simulated: (button: string) =>
      `Es wird nichts übertragen. Nach „${button}“ findet „Erneut prüfen“ eine Mitgliedschaft mit Beitrag.`,
  },
  simulatedHeading: 'Simuliert',
  /** Shared with the profile, see lib/membership/tierLabel.ts. */
  tiers: TIER_LABELS,
};

/**
 * Where the door sends people. Membership is managed outside the app, per the
 * scope, so both go to the browser. The reset address is the support page until
 * the membership system names its own (the C1 dependency).
 */
const LINKS = {
  upgrade: 'https://correctiv.org/unterstuetzen/',
  join: 'https://correctiv.org/unterstuetzen/',
  reset: 'https://correctiv.org/unterstuetzen/',
};

/**
 * The door. Rendered by the root layout in place of the whole route tree while
 * the session is not admitted, so there is no route to deep-link past it.
 *
 * Four states, all on this one surface: signed out (the form), signing in (the
 * form, waiting), failed (the form, with the reason), and signed in without the
 * app (no form: a thanks, the entitlement as it stands, the way in). The page
 * surface rather than the brand red of the mission screen, because a form on red
 * reads as an alarm and this is a front door.
 */
export function LoginGate() {
  const session = useSession();
  const shortfall = accessShortfall(session, Date.now());

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      {/* Inside the safe area, so the bottom inset is not counted twice — the
          component says why. */}
      <KeyboardAvoiding className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-m pt-l pb-m"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Typo variant="headline-m" style={{ letterSpacing: 2 }}>
            {COPY.wordmark}
          </Typo>

          {shortfall ? <NoAccess shortfall={shortfall} /> : <SignInForm />}

          {/* Anchors the note to the bottom on a tall screen; on a short one it
              simply follows the content. */}
          <View className="grow" />
          <Card tone="surface" className="mt-l">
            <Overline label={COPY.simulatedHeading} />
            <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
              {shortfall
                ? COPY.noAccess.simulated(
                    shortfall === 'lapsed' ? COPY.noAccess.resume : COPY.noAccess.upgrade,
                  )
                : COPY.form.simulated}
            </Typo>
          </Card>
        </ScrollView>
      </KeyboardAvoiding>
    </SafeAreaView>
  );
}

function SignInForm() {
  const colors = useColors();
  const actions = useCoreActions();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /**
   * The email field's return key says „Weiter“, and React Native moves no focus on
   * its own: without this the key closed the keyboard on Android and did nothing on
   * iOS, and the person tapped the second field by hand.
   */
  const passwordRef = useRef<TextInput>(null);

  const busy = session.status === 'signing-in';
  const failed = session.status === 'failed';
  const ready = email.includes('@') && password.length > 0;

  const submit = () => {
    if (ready && !busy) void actions.session.signIn(email.trim(), password);
  };

  // A failed attempt marks both fields, not one: the answer does not say which.
  const field = [
    'mt-2xs rounded-md border px-s py-s',
    failed ? 'border-accent' : 'border-stroke',
  ].join(' ');
  const fieldText = [typography['text-m'], { color: colors['on-canvas'] }];

  return (
    <>
      <Typo variant="headline-xxl" family="serif" className="mt-l">
        {COPY.form.headline}
      </Typo>
      <Typo variant="text-l" className="mt-s">
        {COPY.form.lead}
      </Typo>

      <Typo variant="headline-xs" className="mt-m">
        {COPY.form.emailHeading}
      </Typo>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={COPY.form.emailPlaceholder}
        placeholderTextColor={colors['grey-500']}
        accessibilityLabel={COPY.form.emailLabel}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        editable={!busy}
        className={field}
        style={fieldText}
      />

      <Typo variant="headline-xs" className="mt-s">
        {COPY.form.passwordHeading}
      </Typo>
      <TextInput
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        placeholder={COPY.form.passwordPlaceholder}
        placeholderTextColor={colors['grey-500']}
        accessibilityLabel={COPY.form.passwordLabel}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!busy}
        className={field}
        style={fieldText}
      />

      {failed && session.failure && (
        <View className="mt-s flex-row items-start" accessibilityLiveRegion="polite">
          {/* The icon and the field borders carry the coral; the sentence does not.
              Measured against the tokens, `accent` on `canvas` is 3.19:1 in the
              light scheme, below AA for 14 px text, and 5.98:1 in the dark one. The
              colour is not what makes this readable, the words are. */}
          <Ionicons name="alert-circle" size={18} color={colors.accent} />
          <Typo variant="text-s" color="on-canvas" className="ml-2xs flex-1">
            {COPY.form.failure[session.failure]}
          </Typo>
        </View>
      )}

      <View className="mt-m">
        {busy ? (
          <View
            className="flex-row items-center justify-center rounded-md bg-surface px-m py-s"
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator color={colors.accent} />
            <Typo variant="text-m" weight="semibold" className="ml-s">
              {COPY.form.checking}
            </Typo>
          </View>
        ) : (
          <Button title={COPY.form.submit} fullWidth disabled={!ready} onPress={submit} />
        )}
      </View>

      <View className="mt-s flex-row items-center justify-between">
        <TextLink label={COPY.form.forgot} onPress={() => openExternal(LINKS.reset)} />
        <TextLink label={COPY.form.join} strong onPress={() => openExternal(LINKS.join)} />
      </View>
    </>
  );
}

function NoAccess({ shortfall }: { shortfall: AccessShortfall }) {
  const actions = useCoreActions();
  const session = useSession();
  const entitlement = session.entitlement;

  const lapsedOn =
    shortfall === 'lapsed' && entitlement?.validUntil ? formatDateDe(entitlement.validUntil) : null;

  return (
    <>
      <Typo variant="text-s" color="on-canvas-muted" className="mt-l">
        {COPY.noAccess.signedInAs(session.account?.email ?? '')}
      </Typo>
      <Typo variant="headline-xxl" family="serif" className="mt-2xs">
        {COPY.noAccess.headline}
      </Typo>
      <Typo variant="text-l" className="mt-s">
        {COPY.noAccess.lead}
      </Typo>
      <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
        {lapsedOn ? COPY.noAccess.lapsed(lapsedOn) : COPY.noAccess.tier}
      </Typo>

      {/* The entitlement as the membership system answered it. Tier and access,
          never an amount: a trial pays 0 € and has the app. */}
      <Card className="mt-m">
        {/* A trial keeps `tier: 'paid'`, so printing the tier here said „Mitgliedschaft
            mit Beitrag“ directly under a sentence explaining that the app belongs to
            one. The source is what the reader needs in that state. */}
        <Row
          label={COPY.noAccess.tierRow}
          value={
            shortfall === 'lapsed'
              ? COPY.noAccess.tierTrial
              : COPY.tiers[entitlement?.tier ?? 'free']
          }
        />
        <Hairline className="my-s" />
        <Row
          label={COPY.noAccess.accessRow}
          value={lapsedOn ? COPY.noAccess.accessLapsed(lapsedOn) : COPY.noAccess.accessNone}
        />
      </Card>

      <View className="mt-m">
        <Button
          title={lapsedOn ? COPY.noAccess.resume : COPY.noAccess.upgrade}
          fullWidth
          onPress={() => {
            actions.session.upgradeStarted();
            openExternal(LINKS.upgrade);
          }}
        />
        <Button
          title={COPY.noAccess.recheck}
          variant="outline"
          fullWidth
          className="mt-2xs"
          onPress={() => void actions.session.refreshEntitlement()}
        />
      </View>
      <View className="mt-s items-center">
        <TextLink label={COPY.noAccess.switchAccount} onPress={() => actions.session.signOut()} />
      </View>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-s">
      <Typo variant="text-m" color="on-canvas-muted">
        {label}
      </Typo>
      <Typo variant="text-m" weight="semibold" className="flex-1 text-right">
        {value}
      </Typo>
    </View>
  );
}

function TextLink({
  label,
  strong,
  onPress,
}: {
  label: string;
  strong?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="py-2xs active:opacity-60"
    >
      <Typo
        variant="text-s"
        weight={strong ? 'semibold' : 'normal'}
        color={strong ? 'accent' : 'on-canvas-muted'}
      >
        {label}
      </Typo>
    </Pressable>
  );
}
