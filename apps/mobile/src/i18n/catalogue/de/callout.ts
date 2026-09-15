/**
 * German for the `callout.*` ids: a callout, its card, its teaser and its detail
 * screen.
 *
 * Two words that look duplicated are not. `callout.crowdnewsroom.*` is what
 * `lib/participate/calloutStyle.ts` answers for a callout of that kind, and the
 * detail screen states CrowdNewsroom outright for every callout, survey included
 * — that screen was never one of the two places calloutStyle keeps in step, and
 * the migration is not the place to change what it shows.
 */
export const callout: Record<string, string> = {
  'callout.survey.kicker': 'Umfrage',
  'callout.survey.cta': 'Teilnehmen',
  'callout.survey.count':
    '{count, plural, one {Eine Teilnahme} other {{count, number} Teilnahmen}}',
  'callout.survey.countSoFar':
    '{count, plural, one {Eine Teilnahme} other {{count, number} Teilnahmen}} bisher',
  'callout.crowdnewsroom.cta': 'Mitmachen',
  'callout.crowdnewsroom.count':
    '{count, plural, one {Ein Beitrag} other {{count, number} Beiträge}}',
  'callout.crowdnewsroom.countSoFar':
    '{count, plural, one {Ein Beitrag} other {{count, number} Beiträge}} bisher',
  'callout.contributeAgain': 'Weiteren Hinweis geben',
  'callout.card.contributed': '✓ Sie haben beigetragen',
  'callout.teaser.kicker': 'Mitmachen · {kicker}',
  'callout.screenTitle': 'Mitmach-Aufruf',
  'callout.detail.unknownHeadline': 'Diesen Aufruf gibt es nicht',
  'callout.detail.unknownSlug': 'Unbekannte Kennung „{slug}“.',
  'callout.detail.noSlug': 'Es wurde keine Kennung übergeben.',
  'callout.detail.responses':
    '{count, plural, one {Ein Beitrag} other {{count, number} Beiträge}} bisher',
  'callout.detail.whoAsks': 'Wer fragt?',
  'callout.detail.dataUse': 'Was passiert mit Ihren Daten?',
  'callout.detail.contributed':
    '✓ Sie haben bereits beigetragen, danke! Weitere Hinweise sind willkommen.',
  'callout.detail.cta': 'Mitmachen',
};
