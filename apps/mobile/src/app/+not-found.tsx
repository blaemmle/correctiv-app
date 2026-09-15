import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Overline, Screen, Typo } from '@/components/ui';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';

/**
 * What an address that leads nowhere shows.
 *
 * Without this route expo-router falls back to its own "Unmatched Route" page:
 * English, dark, and with a link to the developer sitemap. That page was invisible
 * as long as the app was only installed — a deep link to a route that does not
 * exist is rare and the tour never hit one. On the web it is the site's 404 page,
 * so every mistyped or outdated address published anywhere lands here.
 *
 * `replace`, not push: a page that does not exist is not a place to come back to.
 */
export default function NotFoundScreen() {
  // This is the web target's 404 page, so the tab is read more often here than
  // anywhere: every stale address published anywhere lands on it.
  useDocumentTitle('Seite nicht gefunden');
  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center">
        <Overline label="Fehler 404" color="accent" />
        <Typo variant="headline-l" className="mt-2xs text-center">
          Diese Seite gibt es nicht
        </Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-s text-center">
          Der Link führt ins Leere. Möglicherweise wurde der Beitrag verschoben oder die Adresse ist
          unvollständig.
        </Typo>
        <Button
          title="Zur Startseite"
          className="mt-l self-center"
          onPress={() => {
            router.replace('/');
          }}
        />
      </View>
    </Screen>
  );
}
