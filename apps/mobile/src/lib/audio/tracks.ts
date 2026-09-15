import { defineMessages } from 'react-intl';

import { RADIO_STREAM_URL } from '@correctiv/app-core/data/feeds.config';

/**
 * How the Salon5 live stream names itself, in ENGLISH; the German that ships is
 * in `src/i18n/catalogue/de/player.ts` (ADR 0026 §6).
 *
 * Descriptors rather than strings, because this module holds no React and so
 * cannot call `useIntl`: whoever puts these on a screen or hands them to the
 * platform formats them. They live here rather than in the banner because the
 * banner and the lock screen print the same two words, and the station's name is
 * one fact.
 */
export const SALON5_RADIO_COPY = defineMessages({
  title: { id: 'player.radioTitle', defaultMessage: 'Salon5 Radio' },
  subtitle: { id: 'player.radioSubtitle', defaultMessage: '24/7 from Bottrop' },
});

/**
 * Metadata and source of the Salon5 live stream (Icecast). For player and lock
 * screen.
 *
 * `title` and `artist` are the descriptors above, so a caller building a track
 * formats them first. **Nothing builds one from this constant today**, measured
 * across the app, the handbook and the tests on 2026-09-15: the thunk that starts
 * the stream is `playRadio` in `@correctiv/app-core/stores/audio`, and it carries
 * its own copy of the same two words. The banner on the Mediathek screen is the
 * one place that formats them (`components/media/LiveBanner.tsx`).
 */
export const SALON5_RADIO = {
  id: 'salon5-radio',
  url: RADIO_STREAM_URL,
  title: SALON5_RADIO_COPY.title,
  artist: SALON5_RADIO_COPY.subtitle,
} as const;
