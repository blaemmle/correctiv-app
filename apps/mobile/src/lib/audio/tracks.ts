import { defineMessages, type IntlShape } from 'react-intl';

import { RADIO_STREAM_URL } from '@correctiv/app-core/data/feeds.config';
import type { AudioTrack } from '@correctiv/app-core/types/models';

/**
 * How the Salon5 live stream names itself, in ENGLISH; the German that ships is
 * in `src/i18n/catalogue/de/player.ts` (ADR 0026 §6).
 *
 * Descriptors rather than strings, because this module holds no React and so
 * cannot call `useIntl`: whoever puts these on a screen formats them. They live
 * here rather than in the banner because the banner and the lock screen print the
 * same two words, and the station's name is one fact.
 */
export const SALON5_RADIO_COPY = defineMessages({
  title: { id: 'player.radioTitle', defaultMessage: 'Salon5 Radio' },
  subtitle: { id: 'player.radioSubtitle', defaultMessage: '24/7 from Bottrop' },
});

/**
 * Metadata and source of the Salon5 live stream (Icecast), formatted. For the
 * player and the lock screen.
 *
 * **A function and not a constant, and that is the whole point of this file.** It
 * was `SALON5_RADIO`, an object holding the two descriptors above under `title`
 * and `artist` — the keys a lock screen wants strings in. Nothing built a track
 * from it, measured across the app, the handbook and the tests on 2026-09-15, so
 * the first thing that did would have been the first thing to find out: a
 * descriptor is an ordinary object, `${…}` renders it `[object Object]`, and a
 * platform API taking `any` metadata would have posted that to the notification
 * shade. There is no shape for the caller to get wrong here, because there is no
 * shape until the caller passes an `intl` — the same trade `calloutKicker` in
 * `lib/participate/calloutStyle.ts` makes for the same reason.
 *
 * `Omit<AudioTrack, 'kind'>` is what `lib/audio/player.ts` takes, so the return
 * type is the one a caller needs rather than a second description of a track.
 * Still nothing calls it: the thunk that starts the stream is `playRadio` in
 * `@correctiv/app-core/stores/audio` and it carries its own copy of the same two
 * words, which is issue #141. The banner on the Mediathek screen is the one place
 * that formats them (`components/media/LiveBanner.tsx`).
 */
export function salon5RadioTrack(intl: IntlShape): Omit<AudioTrack, 'kind'> {
  return {
    title: intl.formatMessage(SALON5_RADIO_COPY.title),
    subtitle: intl.formatMessage(SALON5_RADIO_COPY.subtitle),
    url: RADIO_STREAM_URL,
  };
}
