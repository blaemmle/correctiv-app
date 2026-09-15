import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, View, type ListRenderItemInfo } from 'react-native';

import { Overline, ScreenHeader, Typo } from '@/components/ui';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';
import type { SavedArticle } from '@correctiv/app-core/stores/savedArticles';
import { openArticle } from '@/lib/openArticle';
import { useCoreActions, useSavedArticles } from '@/lib/store/core';
import { sizes, useColors } from '@/lib/theme';

const keyExtractor = (article: SavedArticle) => article.url;

const renderSavedRow = ({ item }: ListRenderItemInfo<SavedArticle>) => <SavedRow article={item} />;

const EMPTY = (
  <Typo variant="text-m" color="on-canvas-muted" className="mt-m">
    Noch nichts gespeichert. Tippen Sie im Artikel auf das Lesezeichen, um ihn hier abzulegen.
  </Typo>
);

/**
 * Saved articles — the same list the bookmark in the reader fills. `savedArticles`
 * in the core, persisted, so it survives a restart.
 *
 * A FlatList rather than a mapped ScrollView, because this is one of the two lists
 * in the app whose length nobody here decides: it is however many articles the
 * reader's bookmark has been tapped on, and it only ever grows. A ScrollView mounts
 * every row up front, and each row costs two hook subscriptions (`useCoreActions`,
 * `useColors`) whether or not it is on screen. See ADR 0012 for why the other lists
 * were left alone.
 */
export default function GespeichertScreen() {
  const items = useSavedArticles();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Gespeicherte Artikel" />
      <FlatList
        className="flex-1"
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderSavedRow}
        // The heading belongs to the list, not above it: as a sibling it would sit
        // outside the scroller and stay put while the rows moved under it. The gap
        // below it used to belong to the row container and to the empty notice
        // respectively, which is why it is still two different sizes.
        ListHeaderComponent={
          <Typo variant="headline-l" className={items.length > 0 ? 'mb-s' : ''}>
            Gespeicherte Artikel
          </Typo>
        }
        ListEmptyComponent={EMPTY}
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function SavedRow({ article }: { article: SavedArticle }) {
  const actions = useCoreActions();
  const colors = useColors();
  return (
    <View className="flex-row items-start border-b border-stroke py-s">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={article.title}
        onPress={() => openArticle(article)}
        className="flex-1 pr-s active:opacity-70"
      >
        {article.kicker ? <Overline label={article.kicker} color="accent" /> : null}
        <Typo variant="text-m" weight="bold" numberOfLines={2} className="mt-4xs">
          {article.title}
        </Typo>
        <Typo variant="text-s" color="grey-500" className="mt-2xs">
          gespeichert {formatDateShortDe(article.savedAt)}
        </Typo>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${article.title} entfernen`}
        hitSlop={8}
        onPress={() => actions.savedArticles.remove(article.url)}
        className="items-center justify-center active:opacity-70"
        style={{ width: sizes.iconButtonSmall, height: sizes.iconButtonSmall }}
      >
        <Ionicons name="close" size={18} color={colors['grey-500']} />
      </Pressable>
    </View>
  );
}
