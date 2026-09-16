/**
 * A hand-picked walk through `apps/mobile/src/app`, one entry per route shape.
 *
 * Not generated, so a new screen will not appear here on its own. The route field
 * takes any path, and whatever the frame navigates to is read back live, so this
 * list is a convenience and never the truth about what routes exist. Generating it
 * from the router is an open question: `expo-router` serves `/_sitemap` in a dev
 * build, but the export has none, so a list that is honest in both places has to
 * come from the file tree at build time.
 *
 * An entry can carry a note, because the point of the picker is the pages nobody
 * would guess the address of. `/behauptung/claim-001` is not a thing anybody types.
 */
export interface Page {
  route: string;
  label: string;
  /** One line, shown beside the label. Left out where the label says it all. */
  note?: string;
}

export interface PageGroup {
  group: string;
  pages: Page[];
}

export const PAGES: PageGroup[] = [
  {
    group: 'Tabs',
    pages: [
      { route: '/', label: 'Home' },
      { route: '/entdecken', label: 'Entdecken' },
      { route: '/mediathek', label: 'Mediathek' },
      { route: '/mitmachen', label: 'Mitmachen' },
      { route: '/profil', label: 'Profil' },
    ],
  },
  {
    group: 'Screens',
    pages: [
      { route: '/artikel', label: 'Artikel', note: 'the reader, a WebView' },
      { route: '/spotlight', label: 'Spotlight' },
      { route: '/suche', label: 'Suche' },
      { route: '/gespeichert', label: 'Gespeichert', note: 'a FlatList' },
      { route: '/backstage', label: 'Backstage' },
      { route: '/atlas', label: 'Abriss-Atlas' },
      { route: '/bericht', label: 'Quartalsbericht' },
      { route: '/einstellungen', label: 'Einstellungen' },
      { route: '/faktenforum', label: 'Faktenforum' },
      { route: '/formular', label: 'Formular', note: 'the participation form' },
      { route: '/onboarding', label: 'Onboarding', note: 'a modal' },
      { route: '/player', label: 'Player', note: 'a modal over the running audio' },
      { route: '/video', label: 'Video' },
    ],
  },
  {
    group: 'With an id',
    pages: [
      { route: '/aufruf/wem-gehoert-die-stadt', label: 'Aufruf' },
      { route: '/behauptung/claim-001', label: 'Behauptung' },
      { route: '/projekt/klima', label: 'Projekt' },
      { route: '/serie/klima', label: 'Podcast-Serie', note: 'the second FlatList' },
      { route: '/tagebuch/diary-bern-2', label: 'Tagebuch' },
    ],
  },
  {
    /*
     * The not-found screen is in here as an address on purpose, because any
     * address the app has no route for is one of them.
     *
     * Not the recovery screen, though it belongs in a group like this. It has no
     * address: it is reached by something throwing, and a route that throws would
     * be published like any other. Giving it one is #112's kind of problem.
     */
    group: 'Worth being able to reach',
    pages: [
      {
        route: '/gallery',
        label: 'Component gallery',
        note: 'every component, twice, on both surfaces',
      },
      {
        route: '/diese-seite-gibt-es-nicht',
        label: 'Not found',
        note: 'any address the app has no route for',
      },
    ],
  },
];

/** Flat, for the field's own autocomplete. */
export const ROUTES: string[] = PAGES.flatMap((g) => g.pages.map((p) => p.route));
