import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
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
 * The `defaultMessage` of each is ENGLISH and the German that ships is in
 * `src/i18n/catalogue/de/gate.ts`, which is the shape ADR 0026 §6 decided: the
 * source reads in one language and the other one is data. Nothing here is
 * rendered as written — `formatMessage` answers with the catalogue's German.
 *
 * The fourth block is the one that was written most carefully. It is shown to
 * someone who IS a member, has just signed in, and is told the app is not part of
 * what they have. That is not an error and must not read like one: it thanks, it
 * says what the 0 € membership does cover, it says what the contribution is for,
 * and it offers the way in.
 */
const COPY = defineMessages({
  headline: { id: 'gate.headline', defaultMessage: 'For everyone who carries CORRECTIV.' },
  lead: {
    id: 'gate.lead',
    defaultMessage:
      'This app is the place for members who contribute. Your account is the same one you use on correctiv.org.',
  },
  emailHeading: { id: 'gate.emailHeading', defaultMessage: 'Email' },
  emailLabel: { id: 'gate.emailLabel', defaultMessage: 'Email address' },
  emailPlaceholder: { id: 'gate.emailPlaceholder', defaultMessage: 'name@example.org' },
  passwordHeading: { id: 'gate.passwordHeading', defaultMessage: 'Password' },
  passwordLabel: { id: 'gate.passwordLabel', defaultMessage: 'Enter password' },
  passwordPlaceholder: { id: 'gate.passwordPlaceholder', defaultMessage: 'Your password' },
  submit: { id: 'gate.submit', defaultMessage: 'Sign in' },
  checking: { id: 'gate.checking', defaultMessage: 'Checking your membership …' },
  forgot: { id: 'gate.forgot', defaultMessage: 'Forgotten your password?' },
  join: { id: 'gate.join', defaultMessage: 'Become a member with a contribution' },
  simulated: {
    id: 'gate.simulated',
    defaultMessage:
      'Nothing is transmitted. Every address signs in: with "frei" as the free tier without app access, with "test" during the trial, with "lokal" through the local bundle. A password shorter than four characters fails.',
  },
  simulatedHeading: { id: 'gate.simulatedHeading', defaultMessage: 'Simulated' },
});

/**
 * The reasons a sign-in can fail, one message each.
 *
 * Typed as the record rather than left to inference, so a new member of
 * `SignInFailure` fails to compile here instead of rendering an empty string on
 * the one screen nobody can get past.
 */
const FAILURE: Record<SignInFailure, MessageDescriptor> = defineMessages({
  'wrong-credentials': {
    id: 'gate.failure.wrongCredentials',
    defaultMessage: 'That email address and password do not match. Please check both.',
  },
  unreachable: {
    id: 'gate.failure.unreachable',
    defaultMessage:
      'correctiv.org cannot be reached at the moment. Please try again in a few minutes.',
  },
});

const NO_ACCESS = defineMessages({
  signedInAs: { id: 'gate.noAccess.signedInAs', defaultMessage: 'Signed in as {email}' },
  headline: { id: 'gate.noAccess.headline', defaultMessage: 'Good to have you with us.' },
  lead: {
    id: 'gate.noAccess.lead',
    defaultMessage: 'The app is part of membership with a contribution.',
  },
  tier: {
    id: 'gate.noAccess.tier',
    defaultMessage:
      'Your account is on the free tier. It keeps everything on correctiv.org open to you. The app comes with the contribution: it funds the investigations, and in return there is audio, video and formats that exist only here.',
  },
  lapsed: {
    id: 'gate.noAccess.lapsed',
    defaultMessage:
      'Your trial ended on {date}. Thank you for trying the app. With a contribution it carries on here, with everything you already know.',
  },
  tierRow: { id: 'gate.noAccess.tierRow', defaultMessage: 'Your tier' },
  tierTrial: { id: 'gate.noAccess.tierTrial', defaultMessage: 'Trial' },
  accessRow: { id: 'gate.noAccess.accessRow', defaultMessage: 'App access' },
  accessNone: { id: 'gate.noAccess.accessNone', defaultMessage: 'Not included' },
  accessLapsed: { id: 'gate.noAccess.accessLapsed', defaultMessage: 'Trial, ended on {date}' },
  upgrade: { id: 'gate.noAccess.upgrade', defaultMessage: 'Extend membership' },
  resume: { id: 'gate.noAccess.resume', defaultMessage: 'Set a contribution' },
  recheck: { id: 'gate.noAccess.recheck', defaultMessage: 'Check again' },
  switchAccount: {
    id: 'gate.noAccess.switchAccount',
    defaultMessage: 'Sign in with a different account',
  },
  simulated: {
    id: 'gate.noAccess.simulated',
    defaultMessage:
      'Nothing is transmitted. After "{button}", "Check again" finds a membership with a contribution.',
  },
});

/**
 * The wordmark, and the one string on this screen that is not a message.
 *
 * A mark is not a sentence: it is the same eleven letters in every language, and a
 * catalogue entry mapping CORRECTIV to CORRECTIV would be a line for a translator
 * to wonder about. The tier names are the same kind of exception one level up —
 * see `lib/membership/tierLabel.ts`, which the profile prints too.
 */
const WORDMARK = 'CORRECTIV';

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
  const intl = useIntl();
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
            {WORDMARK}
          </Typo>

          {shortfall ? <NoAccess shortfall={shortfall} /> : <SignInForm />}

          {/* Anchors the note to the bottom on a tall screen; on a short one it
              simply follows the content. */}
          <View className="grow" />
          <Card tone="surface" className="mt-l">
            <Overline label={intl.formatMessage(COPY.simulatedHeading)} />
            <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
              {shortfall
                ? intl.formatMessage(NO_ACCESS.simulated, {
                    button: intl.formatMessage(
                      shortfall === 'lapsed' ? NO_ACCESS.resume : NO_ACCESS.upgrade,
                    ),
                  })
                : intl.formatMessage(COPY.simulated)}
            </Typo>
          </Card>
        </ScrollView>
      </KeyboardAvoiding>
    </SafeAreaView>
  );
}

function SignInForm() {
  const intl = useIntl();
  const colors = useColors();
  const actions = useCoreActions();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  /**
   * The email field's return key says "Weiter", and React Native moves no focus on
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
        {intl.formatMessage(COPY.headline)}
      </Typo>
      <Typo variant="text-l" className="mt-s">
        {intl.formatMessage(COPY.lead)}
      </Typo>

      <Typo variant="headline-xs" className="mt-m">
        {intl.formatMessage(COPY.emailHeading)}
      </Typo>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={intl.formatMessage(COPY.emailPlaceholder)}
        placeholderTextColor={colors['grey-500']}
        accessibilityLabel={intl.formatMessage(COPY.emailLabel)}
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
        {intl.formatMessage(COPY.passwordHeading)}
      </Typo>
      <TextInput
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        placeholder={intl.formatMessage(COPY.passwordPlaceholder)}
        placeholderTextColor={colors['grey-500']}
        accessibilityLabel={intl.formatMessage(COPY.passwordLabel)}
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
            {intl.formatMessage(FAILURE[session.failure])}
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
              {intl.formatMessage(COPY.checking)}
            </Typo>
          </View>
        ) : (
          <Button
            title={intl.formatMessage(COPY.submit)}
            fullWidth
            disabled={!ready}
            onPress={submit}
          />
        )}
      </View>

      <View className="mt-s flex-row items-center justify-between">
        <TextLink
          label={intl.formatMessage(COPY.forgot)}
          onPress={() => openExternal(LINKS.reset)}
        />
        <TextLink
          label={intl.formatMessage(COPY.join)}
          strong
          onPress={() => openExternal(LINKS.join)}
        />
      </View>
    </>
  );
}

function NoAccess({ shortfall }: { shortfall: AccessShortfall }) {
  const intl = useIntl();
  const actions = useCoreActions();
  const session = useSession();
  const entitlement = session.entitlement;

  const lapsedOn =
    shortfall === 'lapsed' && entitlement?.validUntil ? formatDateDe(entitlement.validUntil) : null;

  return (
    <>
      <Typo variant="text-s" color="on-canvas-muted" className="mt-l">
        {intl.formatMessage(NO_ACCESS.signedInAs, { email: session.account?.email ?? '' })}
      </Typo>
      <Typo variant="headline-xxl" family="serif" className="mt-2xs">
        {intl.formatMessage(NO_ACCESS.headline)}
      </Typo>
      <Typo variant="text-l" className="mt-s">
        {intl.formatMessage(NO_ACCESS.lead)}
      </Typo>
      <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
        {lapsedOn
          ? intl.formatMessage(NO_ACCESS.lapsed, { date: lapsedOn })
          : intl.formatMessage(NO_ACCESS.tier)}
      </Typo>

      {/* The entitlement as the membership system answered it. Tier and access,
          never an amount: a trial pays 0 € and has the app. */}
      <Card className="mt-m">
        {/* A trial keeps `tier: 'paid'`, so printing the tier here said "Mitgliedschaft
            mit Beitrag" directly under a sentence explaining that the app belongs to
            one. The source is what the reader needs in that state. */}
        <Row
          label={intl.formatMessage(NO_ACCESS.tierRow)}
          value={
            shortfall === 'lapsed'
              ? intl.formatMessage(NO_ACCESS.tierTrial)
              : TIER_LABELS[entitlement?.tier ?? 'free']
          }
        />
        <Hairline className="my-s" />
        <Row
          label={intl.formatMessage(NO_ACCESS.accessRow)}
          value={
            lapsedOn
              ? intl.formatMessage(NO_ACCESS.accessLapsed, { date: lapsedOn })
              : intl.formatMessage(NO_ACCESS.accessNone)
          }
        />
      </Card>

      <View className="mt-m">
        <Button
          title={intl.formatMessage(lapsedOn ? NO_ACCESS.resume : NO_ACCESS.upgrade)}
          fullWidth
          onPress={() => {
            actions.session.upgradeStarted();
            openExternal(LINKS.upgrade);
          }}
        />
        <Button
          title={intl.formatMessage(NO_ACCESS.recheck)}
          variant="outline"
          fullWidth
          className="mt-2xs"
          onPress={() => void actions.session.refreshEntitlement()}
        />
      </View>
      <View className="mt-s items-center">
        <TextLink
          label={intl.formatMessage(NO_ACCESS.switchAccount)}
          onPress={() => actions.session.signOut()}
        />
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
