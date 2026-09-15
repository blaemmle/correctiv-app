import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { de } from '@/i18n/catalogue/de';

/**
 * Every route pushed over the tabs names itself, and no two name themselves the
 * same.
 *
 * Until ADR 0030 no `Stack.Screen` in this app set a title. On iOS and Android
 * that costs nothing visible yet, because the app drew its own bars; on the
 * published web target it meant every pushed route shipped an empty `<title>`,
 * so `/gespeichert` and `/backstage` were one browser tab apart and told apart
 * only by the address. Nothing could see it: the build is green, the typecheck is
 * green, and a missing title reads as the address bar doing its job.
 *
 * `title` is a required prop now, so the typechecker catches an absent one on a
 * screen that has a header. What it cannot catch is the three ways this defect
 * actually comes back — a placeholder that says nothing, a title copied from the
 * screen next door, and a route with no header at all, which inherits the title
 * of the screen it was pushed over and therefore names the wrong screen rather
 * than none. Those are what this file is for.
 *
 * Read as text rather than imported: importing a route pulls in the app's whole
 * component tree to answer a question about twenty string literals.
 */
const ROUTES = resolve(__dirname, '../src/app');

/** A tab root. Its tab is the app's entry page and nothing pushes it. */
const TAB_ROOT = /^\(tabs\)\//;
/** Not a screen: the navigators. */
const LAYOUT = /(^|\/)_layout(\.\w+)?\.tsx$/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry.endsWith('.tsx') ? [full] : [];
  });
}

/**
 * The German a descriptor key stands for, found in the route's own source.
 *
 * A migrated route writes `title={intl.formatMessage(COPY.screenTitle)}`, so the
 * word itself is two hops away: the key names a descriptor in the same file, the
 * descriptor carries an id, and the id is what the catalogue answers. Both hops
 * are done here rather than by importing the route, for the reason the file
 * header gives — and the catalogue is a plain object, so importing THAT costs
 * nothing.
 *
 * Returns undefined when either hop fails, and the caller keeps the key. That is
 * deliberate: a key with no descriptor, or an id with no German, should surface
 * as a title this file can then judge, not vanish and take the route's only name
 * with it. A vanishing title is precisely the defect the suite exists to catch.
 */
function germanFor(source: string, key: string): string | undefined {
  const descriptor = new RegExp(`\\b${key}:\\s*\\{[^}]*?\\bid:\\s*'([^']+)'`, 's').exec(source);
  return descriptor ? de[descriptor[1]] : undefined;
}

/**
 * Every name a route gives itself.
 *
 * Four spellings now, from two independent splits. One is where the title goes:
 * a screen with a `ScreenHeader` passes it a `title`, and the five without one —
 * the reader, the player, the onboarding, the gallery and the 404 — call
 * `useDocumentTitle` directly, which is the same string reaching the same place
 * by the shorter route (ADR 0030).
 *
 * The other is how the title is spelled. Before the localisation seam every one
 * was a German literal; a migrated screen names a message descriptor instead and
 * the German lives in the catalogue (issue #99). Both spellings are read, and
 * both resolve to the German, because what the three assertions below test is
 * the word a person sees: whether two routes share it, whether it says anything,
 * and whether it is typed the way German is typed. A route that had been
 * migrated would otherwise contribute nothing at all and pass every one of them
 * by being invisible — which is how a missing title got into the app in the
 * first place.
 */
function headerTitlesIn(source: string): string[] {
  return [
    ...[...source.matchAll(/<ScreenHeader\b[^>]*?\btitle="([^"]*)"/gs)].map((m) => m[1]),
    ...[...source.matchAll(/<ScreenHeader\b[^>]*?\btitle=\{[^}]*?\bCOPY\.(\w+)/gs)].map(
      (m) => germanFor(source, m[1]) ?? m[1],
    ),
  ];
}

function titlesIn(source: string): string[] {
  return [
    ...headerTitlesIn(source),
    ...[...source.matchAll(/\buseDocumentTitle\('([^']*)'\)/g)].map((m) => m[1]),
    ...[...source.matchAll(/\buseDocumentTitle\([^)]*?\bCOPY\.(\w+)/g)].map(
      (m) => germanFor(source, m[1]) ?? m[1],
    ),
  ];
}

describe('screen titles', () => {
  const routes = routeFiles(ROUTES).map((file) => ({
    rel: relative(ROUTES, file).replaceAll('\\', '/'),
    source: readFileSync(file, 'utf8'),
  }));

  const named = routes.filter(({ source }) => titlesIn(source).length > 0);

  it('finds the routes that name themselves', () => {
    // A moved route tree would otherwise make this whole file pass by having
    // nothing to say.
    expect(named.length).toBeGreaterThan(10);
  });

  it('names every route that is pushed over the tabs', () => {
    // The five tab roots keep the entry page's tab, which is the app's address
    // and is a separate, smaller change. Everything else is pushed on top of one
    // of them, and a pushed route with no name of its own does not leave the tab
    // empty — it leaves it reading the screen underneath.
    const nameless = routes.filter(
      ({ rel, source }) =>
        !TAB_ROOT.test(rel) && !LAYOUT.test(rel) && titlesIn(source).length === 0,
    );

    expect(nameless.map((r) => r.rel)).toEqual([]);
  });

  it('gives every ScreenHeader call site a title', () => {
    const offenders = routes.filter(({ source }) => {
      const calls = source.match(/<ScreenHeader\b/g)?.length ?? 0;
      // Both spellings, through the same helper the rest of the file uses: a
      // call site whose title is a descriptor has a title, and counting only
      // literals here would report every migrated screen as untitled.
      return headerTitlesIn(source).filter((t) => t.trim().length > 0).length !== calls;
    });

    expect(offenders.map((r) => r.rel)).toEqual([]);
  });

  it('gives every route a title of its own', () => {
    // One title per route, not per call site: `formular.tsx` has two headers and
    // they are two states of one screen. A duplicate ACROSS routes is the defect
    // — it is what the web target looked like when every page had none.
    const byTitle = new Map<string, string[]>();
    for (const { rel, source } of named) {
      for (const title of new Set(titlesIn(source))) {
        byTitle.set(title, [...(byTitle.get(title) ?? []), rel]);
      }
    }

    const shared = [...byTitle].filter(([, routes_]) => routes_.length > 1);

    expect(shared).toEqual([]);
  });

  it('writes them in German typography, with no em dash', () => {
    // AGENTS.md: everything a user reads is German, and a German sentence uses
    // „…“ and never an em dash. A title is the shortest user-facing string in the
    // app and the easiest one to have typed in English by habit.
    //
    // U+201C is NOT in this class, because it is German's CLOSING quote and only
    // English's opening one: „Abriss-Atlas“ is correct and has to pass. What is
    // rejected is U+201D, which is English's closing quote and appears in German
    // only by mistake, and the straight `"`, which is reachable now that a title
    // can also be written inside `useDocumentTitle('…')`.
    const offenders = named.flatMap(({ rel, source }) =>
      titlesIn(source)
        .filter((title) => /[—”"]/.test(title))
        .map((title) => `${rel}: ${title}`),
    );

    expect(offenders).toEqual([]);
  });
});
