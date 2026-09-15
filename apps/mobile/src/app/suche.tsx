import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';

import { SampleHitRow, sampleTarget } from '@/components/discover/SampleHitRow';
import { ArticleRow } from '@/components/feed/ArticleRow';
import { KeyboardAvoiding } from '@/components/keyboard/KeyboardAvoiding';
import { Hairline, Overline, ScreenHeader, Typo } from '@/components/ui';
import { searchSamples } from '@correctiv/app-core/data/search-samples';
import { MIN_SEARCH_QUERY } from '@correctiv/app-core/stores/search';
import type { FeedItem } from '@correctiv/app-core/types/models';
import { openArticle } from '@/lib/openArticle';
import { useCoreActions } from '@/lib/store/core';
import { typography, useColors } from '@/lib/theme';
import { useDebounced } from '@/lib/useDebounced';

const DEBOUNCE_MS = 300;

/**
 * Full-text search over correctiv.org, with a local fallback.
 *
 * The cascade itself — live first, the loaded feeds on an error or an empty result
 * — is `@correctiv/app-core/stores/search`, tested there against a seeded store.
 * What is left here is the screen's own: a debounce, a spinner, and which of the
 * three empty states to show.
 *
 * The project hits (podcasts, callouts, backstage, publishing) are not in the feeds
 * and are filtered locally — without a debounce, because that costs nothing.
 */
export default function SucheScreen() {
  const colors = useColors();
  const actions = useCoreActions();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, DEBOUNCE_MS);

  const [articles, setArticles] = useState<FeedItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (debounced.length < MIN_SEARCH_QUERY) {
      setArticles([]);
      setSearching(false);
      return;
    }
    let active = true;

    // setState sits in the inner async run, not in the effect body, which is what
    // keeps this safe for the React compiler.
    const run = async () => {
      setSearching(true);
      const hits = await actions.search.run(debounced);
      if (active) setArticles(hits);
    };

    run().finally(() => {
      if (active) setSearching(false);
    });

    return () => {
      // A superseded run writes nothing: the latest input wins.
      active = false;
    };
  }, [debounced, actions]);

  const sampleHits = useMemo(() => {
    if (trimmed.length < MIN_SEARCH_QUERY) return [];
    const needle = trimmed.toLowerCase();
    return searchSamples.filter(
      (s) => s.title.toLowerCase().includes(needle) || s.subtitle.toLowerCase().includes(needle),
    );
  }, [trimmed]);

  const tooShort = debounced.length < MIN_SEARCH_QUERY;
  const nothingFound = !tooShort && !searching && articles.length === 0 && sampleHits.length === 0;

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Suchen …"
          placeholderTextColor={colors['grey-500']}
          accessibilityLabel="Suchbegriff"
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          className="rounded-s bg-surface px-s py-xs"
          style={[typography['text-m'], { color: colors['on-canvas'] }]}
        />
      </ScreenHeader>

      {/* Results, not the field: the field sits in the bar above and does not
          move. What the keyboard would otherwise take is the list, and with it
          every hit below the first two. */}
      <KeyboardAvoiding className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-m pt-s pb-2xl"
          showsVerticalScrollIndicator={false}
          // Without "handled", the first tap on a result only swallows the keyboard
          // instead of opening the article.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {tooShort && (
            <Typo variant="text-m" color="on-canvas-muted">
              Suchen Sie über Recherchen, Faktenchecks, Projekte, Podcasts und Mitmach-Aktionen.
            </Typo>
          )}

          {searching && articles.length === 0 && (
            <View className="py-l">
              <ActivityIndicator color={colors.accent} />
            </View>
          )}

          {articles.length > 0 && (
            <View>
              <Overline label="Artikel" />
              <View className="mt-2xs">
                {articles.map((item, i) => (
                  <View key={item.id}>
                    {i > 0 && <Hairline />}
                    <ArticleRow item={item} onPress={openArticle} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {sampleHits.length > 0 && (
            <View className="mt-m">
              <Overline label="Aus den Projekten" />
              <View className="mt-2xs">
                {sampleHits.map((hit) => {
                  const target = sampleTarget(hit.kind);
                  return (
                    <SampleHitRow
                      key={hit.id}
                      hit={hit}
                      onPress={target ? () => router.push(target) : undefined}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {nothingFound && (
            <Typo variant="text-m" color="on-canvas-muted">
              Keine Treffer für „{debounced}“.
            </Typo>
          )}
        </ScrollView>
      </KeyboardAvoiding>
    </View>
  );
}
