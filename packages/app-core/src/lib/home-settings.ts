/**
 * What a place on the home screen may be configured to show.
 *
 * ADR 0036 §2 made the *arrangement* data and left what each place draws to the module
 * that draws it. [ADR 0039](../../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md)
 * §4 opens the second half: a section carries a `settings` object, its shape depends on
 * its module, and a moment can change one setting without restating the rest.
 *
 * ## Why the table is here and not in the host
 *
 * The parser has to refuse a setting a module does not understand, the way it already
 * refuses a key a section does not understand — a fetched document is somebody else's
 * file, and a place configured by a rule this app cannot apply is a place the newsroom
 * believes it configured. Refusing means knowing, so **which keys exist is part of the
 * document's grammar**, and the grammar is this package's.
 *
 * What is NOT here is which modules a host can draw: that is the host's, it arrives as
 * `renderable` in `parseHomeLayout`, and the two questions are asked separately. Nor are
 * the words an editor reads. A label is how the workbench asks a person for a value, so
 * it lives beside the module labels the workbench already keeps, and
 * `apps/workbench/test/preview/home-document.test.ts` holds the two lists together in
 * both directions.
 *
 * ## Why every setting carries its default
 *
 * `latest-research` drew five items because `slice(1, 6)` said so in the app. The moment
 * an editor can change that number, "five" is a fact in two places — the module that
 * slices and the editor that has to show what happens when nobody has chosen. It is one
 * place, here, and both read it.
 *
 * A module with no entry below understands no settings, which is most of them. That is
 * not an omission to fill in: a setting exists because somebody named an editorial
 * question it answers, and inventing one because a module looked bare is how a
 * configuration surface grows fields nobody uses and everybody has to keep working.
 */

/** A choice of one item, by the address the app already addresses it with. */
export interface ArticleSetting {
  readonly key: string;
  readonly kind: 'article';
  /**
   * `null` is the value, not the absence of one.
   *
   * ADR 0036 §3: every place has a rule, and the configuration may override it with a
   * specific item. `null` is that override being taken off again, which an editor has to
   * be able to say at a later moment — "the morning pins this, the afternoon goes back to
   * whatever is newest" is one change and not the deletion of one.
   */
  readonly fallback: null;
}

/** A whole number of items, within bounds the module can actually draw. */
export interface CountSetting {
  readonly key: string;
  readonly kind: 'count';
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

export type SettingSpec = ArticleSetting | CountSetting;

/**
 * The settings themselves, each named, then the table that says whose they are.
 *
 * Named rather than written inline in the table below, because a module that READS one
 * needs its exact kind and not the union: `pinnedItem(settings, HERO_PIN)` type-checks
 * and `pinnedItem(settings, MODULE_SETTINGS['article-hero'][0])` does not, since the
 * table is keyed by a string and answers with the union. Two constants and a table built
 * from them is one fact in one place either way.
 */
export const HERO_PIN: ArticleSetting = { key: 'pin', kind: 'article', fallback: null };

export const RESEARCH_COUNT: CountSetting = {
  key: 'count',
  kind: 'count',
  min: 1,
  max: 8,
  fallback: 5,
};

export const FACT_CHECK_COUNT: CountSetting = {
  key: 'count',
  kind: 'count',
  min: 1,
  max: 12,
  fallback: 8,
};

/**
 * Module name, as the document writes it, to the settings it understands.
 *
 * Three settings over two kinds, which is deliberately the smallest table that proves
 * the mechanism: different blocks want different settings, and one of them is the
 * "which article does this block highlight" the product side asked for by name.
 */
export const MODULE_SETTINGS: Readonly<Record<string, readonly SettingSpec[]>> = {
  'article-hero': [HERO_PIN],
  'latest-research': [RESEARCH_COUNT],
  'faktencheck-rail': [FACT_CHECK_COUNT],
};

/** What a module understands, which for most of them is nothing. */
export function settingsFor(module: string): readonly SettingSpec[] {
  return MODULE_SETTINGS[module] ?? [];
}

/**
 * A place's settings as the two kinds read them, or the module's own default.
 *
 * Two accessors rather than one generic, because the two kinds answer different
 * questions and a caller always knows which it is asking. The cast in each is the seam
 * between a document that has been validated and a caller that knows what it asked for:
 * `parseHomeLayout` checked this value against the same spec, so a `count` here is an
 * integer within its bounds and a `pin` is a non-empty string or `null`.
 *
 * A module drawing a setting it does not declare reads `undefined` and gets the
 * fallback, which is the same thing it drew before the setting existed.
 */
type Held = Readonly<Record<string, unknown>> | undefined;

export function pinnedItem(settings: Held, spec: ArticleSetting): string | null {
  const held = settings?.[spec.key];
  return typeof held === 'string' ? held : spec.fallback;
}

export function itemCount(settings: Held, spec: CountSetting): number {
  const held = settings?.[spec.key];
  return typeof held === 'number' ? held : spec.fallback;
}
