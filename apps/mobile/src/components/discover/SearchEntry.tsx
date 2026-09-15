import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import { Typo } from '@/components/ui';
import { useColors } from '@/lib/theme';

/**
 * What the entry point says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/discover.ts`. The label is what a screen reader
 * announces, which is as user-facing as the line beside it.
 */
const COPY = defineMessages({
  openSearch: { id: 'discover.openSearch', defaultMessage: 'Open search' },
  placeholder: {
    id: 'discover.searchPlaceholder',
    defaultMessage: 'Investigations, fact checks, projects …',
  },
});

/**
 * The search entry point on Entdecken — a dummy that pushes /suche, not an input.
 * Exactly as in the design draft: the keyboard should only come up on the search
 * screen, so that the directory stays visible when the tab is opened.
 */
export function SearchEntry({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={intl.formatMessage(COPY.openSearch)}
      className="flex-row items-center rounded-md bg-surface px-s active:opacity-80"
      style={{ height: 44 }}
    >
      <Ionicons name="search" size={18} color={colors['on-canvas-muted']} />
      <Typo variant="text-m" color="grey-500" className="ml-xs">
        {intl.formatMessage(COPY.placeholder)}
      </Typo>
    </Pressable>
  );
}
