import { defineMessages, type IntlShape, type MessageDescriptor } from 'react-intl';

import type { Callout } from '@correctiv/app-core/data/callouts';

/**
 * The words this module answers with, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/callout.ts`.
 *
 * Descriptors rather than strings, because there is no React here and therefore
 * no `useIntl()` to call: this is a plain function two components share, so it
 * hands back what to say and the call sites, which are components, say it.
 *
 * The counters are ICU plurals. A callout with a single response printed the
 * plural noun anyway before this, and the phrase differs per kind, so the unit
 * cannot be a word glued onto a number by whoever renders it.
 */
const MESSAGES = defineMessages({
  surveyKicker: { id: 'callout.survey.kicker', defaultMessage: 'Survey' },
  surveyCta: { id: 'callout.survey.cta', defaultMessage: 'Take part' },
  surveyCount: {
    id: 'callout.survey.count',
    defaultMessage: '{count, plural, one {One response} other {{count, number} responses}}',
  },
  surveyCountSoFar: {
    id: 'callout.survey.countSoFar',
    defaultMessage: '{count, plural, one {One response} other {{count, number} responses}} so far',
  },
  crowdnewsroomCta: { id: 'callout.crowdnewsroom.cta', defaultMessage: 'Take part' },
  crowdnewsroomCount: {
    id: 'callout.crowdnewsroom.count',
    defaultMessage: '{count, plural, one {One contribution} other {{count, number} contributions}}',
  },
  crowdnewsroomCountSoFar: {
    id: 'callout.crowdnewsroom.countSoFar',
    defaultMessage:
      '{count, plural, one {One contribution} other {{count, number} contributions}} so far',
  },
});

/**
 * The CrowdNewsroom kicker is the product's name, not a word about it. A
 * catalogue entry mapping CrowdNewsroom to CrowdNewsroom would be a line for a
 * translator to wonder about, which is the same call `gate/LoginGate.tsx` makes
 * for the wordmark — so this one kicker is a plain string and `calloutKicker`
 * below is where the two cases meet.
 */
const CROWDNEWSROOM = 'CrowdNewsroom';

export type CalloutStyle = {
  /** Kicker above the title. A mark rather than a message where it is a mark. */
  kicker: MessageDescriptor | string;
  /** Button label. */
  cta: MessageDescriptor;
  /** How loud the button is: a survey asks less than a CrowdNewsroom. */
  variant: 'primary' | 'outline';
  /** The counter with its unit, taking `count`. */
  count: MessageDescriptor;
  /** The same counter where the card says how many have taken part so far. */
  countSoFar: MessageDescriptor;
};

/**
 * How a callout presents itself, from its kind.
 *
 * Two places need the same answer — the card on Mitmachen and the module on Home —
 * and the draft ties three decisions to that one fact: what the kicker says, what
 * the button says, and how much weight the button carries. Written out separately
 * in two files they would be two truths free to drift apart, which is how all three
 * callouts ended up labelled CROWDNEWSROOM with the same loud coral button.
 */
export function calloutStyle(callout: Callout): CalloutStyle {
  if (callout.kind === 'survey') {
    return {
      kicker: MESSAGES.surveyKicker,
      cta: MESSAGES.surveyCta,
      variant: 'outline',
      count: MESSAGES.surveyCount,
      countSoFar: MESSAGES.surveyCountSoFar,
    };
  }
  return {
    kicker: CROWDNEWSROOM,
    cta: MESSAGES.crowdnewsroomCta,
    variant: 'primary',
    count: MESSAGES.crowdnewsroomCount,
    countSoFar: MESSAGES.crowdnewsroomCountSoFar,
  };
}

/** The kicker as a string, whichever of the two kinds it is. */
export function calloutKicker(intl: IntlShape, style: CalloutStyle): string {
  return typeof style.kicker === 'string' ? style.kicker : intl.formatMessage(style.kicker);
}
