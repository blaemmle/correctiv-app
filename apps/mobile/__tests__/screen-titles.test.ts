import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Every route that has a header names itself, and no two name themselves the
 * same.
 *
 * Until ADR 0030 no `Stack.Screen` in this app set a title. On iOS and Android
 * that costs nothing visible yet, because the app drew its own bars; on the
 * published web target it meant every pushed route shipped an empty `<title>`,
 * so `/gespeichert` and `/backstage` were one browser tab apart and told apart
 * only by the address. Nothing could see it: the build is green, the typecheck is
 * green, and a missing title reads as the address bar doing its job.
 *
 * `title` is a required prop now, so the typechecker catches an absent one. What
 * it cannot catch is the two ways this defect actually comes back — a placeholder
 * that says nothing, and a title copied from the screen next door — and those are
 * what this file is for.
 *
 * Read as text rather than imported: importing a route pulls in the app's whole
 * component tree to answer a question about fifteen string literals.
 */
const ROUTES = resolve(__dirname, '../src/app');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry.endsWith('.tsx') ? [full] : [];
  });
}

/** `title="…"` on every `<ScreenHeader>` in one file, in source order. */
function titlesIn(source: string): string[] {
  return [...source.matchAll(/<ScreenHeader\b[^>]*?\btitle="([^"]*)"/gs)].map((m) => m[1]);
}

describe('screen titles', () => {
  const withHeader = routeFiles(ROUTES)
    .map((file) => ({
      rel: relative(ROUTES, file).replaceAll('\\', '/'),
      source: readFileSync(file, 'utf8'),
    }))
    .filter(({ source }) => /<ScreenHeader\b/.test(source));

  it('finds the routes that have a header', () => {
    // A moved route tree would otherwise make this whole file pass by having
    // nothing to say.
    expect(withHeader.length).toBeGreaterThan(10);
  });

  it('gives every call site a title', () => {
    const offenders = withHeader.filter(({ source }) => {
      const calls = source.match(/<ScreenHeader\b/g)?.length ?? 0;
      return titlesIn(source).filter((t) => t.trim().length > 0).length !== calls;
    });

    expect(offenders.map((r) => r.rel)).toEqual([]);
  });

  it('gives every route a title of its own', () => {
    // One title per route, not per call site: `formular.tsx` has two headers and
    // they are two states of one screen. A duplicate ACROSS routes is the defect
    // — it is what the web target looked like when every page had none.
    const byTitle = new Map<string, string[]>();
    for (const { rel, source } of withHeader) {
      for (const title of new Set(titlesIn(source))) {
        byTitle.set(title, [...(byTitle.get(title) ?? []), rel]);
      }
    }

    const shared = [...byTitle].filter(([, routes]) => routes.length > 1);

    expect(shared).toEqual([]);
  });

  it('writes them in German typography, with no em dash', () => {
    // AGENTS.md: everything a user reads is German, and a German sentence uses
    // „…“ and never an em dash. A title is the shortest user-facing string in the
    // app and the easiest one to have typed in English by habit.
    const offenders = [...withHeader].flatMap(({ rel, source }) =>
      titlesIn(source)
        .filter((title) => /[—“”"]/.test(title))
        .map((title) => `${rel}: ${title}`),
    );

    expect(offenders).toEqual([]);
  });
});
