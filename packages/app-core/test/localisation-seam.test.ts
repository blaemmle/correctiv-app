import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { withoutComments } from './support/source';

/**
 * German in the core, and why this file exists at all.
 *
 * `apps/mobile/__tests__/localisation-seam.test.ts` holds the same net over
 * `apps/mobile/src`, and until the core's four user-facing strings were lifted
 * (#141) that was the whole of it — the core was simply not a place German lived,
 * so nothing had to say it could not grow there. The lift makes it one: the core
 * now owns descriptors, and a descriptor is one careless `defaultMessage` away
 * from being the German itself. An unwatched workspace is where a migrated
 * codebase grows its German back, and it grows it in the half nobody is looking
 * at.
 *
 * The other half of the seam needs no counterpart here and has one anyway.
 * `npm run i18n:extract` already globs every `.ts` under `packages/app-core/src`, so
 * every `core.` id lands in `en.json` and the app's test pairs it against
 * `catalogue/de/core.ts` in both directions. What that cannot see is a German
 * string that never became a descriptor, which is exactly what this walk is for.
 *
 * The shape is `boundary.test.ts`'s and the app's: walk the tree, collect the
 * offenders, assert the list is empty, and assert the same of the excuses.
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url));

/**
 * The characters that betray a German string. A partial net on purpose, and the
 * same one the app uses: "Suchen" slips through, and no cheap check catches it.
 */
const GERMAN_CHARACTERS = /[äöüßÄÖÜ„“]/;

/**
 * `src/data/`, which is content rather than UI.
 *
 * ADR 0026 §6 gives the rule and it is worth typing out rather than pointing at:
 * *would this string still exist if the content came from a CMS?* The project
 * descriptions, the Spotlight subjects, the sample claims and the Abriss-Atlas
 * reports would all arrive from one, so they are the articles' case and not the
 * seam's. Excluded by path, because the answer is the same for every file in
 * there and listing two hundred strings below would bury the four that matter.
 *
 * One member of that directory is NOT content and was decided rather than
 * assumed: `data/abriss-atlas.ts` types a report's status as
 * `'gemeldet' | 'bestätigt'`. A union of states is vocabulary in data's clothing
 * — a CMS would still have to say which of the two a report is — but it is
 * vocabulary in the IDENTIFIER, not in a string a screen prints, and
 * `apps/mobile/src/app/atlas.tsx` already spells both out in its own
 * `STATUS_LABELS`. Renaming the two values to English is a change to sample data
 * with no user-visible half, so it is worth doing and is not worth doing here,
 * where it would arrive mixed into a lift of somebody else's strings.
 */
const CONTENT = /^data\//;

/**
 * The German that is still written in the core, and why each one is. Each entry
 * is the STRING, not the file it sits in — a whole-file exemption excuses
 * everything anybody adds to that file afterwards.
 *
 * Asserted in both directions, as the app's is: German that is not one of these
 * fails, and a fragment named here that its file no longer contains fails too, so
 * a reason cannot outlive the thing it was about.
 *
 * None of these is a string a person reads, which is the test each one had to
 * pass. They are German as INPUT (a pattern that matches somebody else's prose,
 * a key in somebody else's JSON) and German as a CHARACTER (a quotation mark that
 * is the value, not the language).
 */
const GERMAN_OUTSIDE_THE_CATALOGUE: Record<string, string[]> = {
  // Patterns over the prose correctiv.org publishes beside its verdict image, so
  // the German is the thing being READ. A translation of these would stop them
  // matching the pages they exist for. The labels this file used to hold beside
  // them are gone — they are `RATING_LABELS`, and their German is in the
  // catalogue.
  'articles/rating.ts': [
    'gr(ö|oe)(ß|ss)tenteils falsch',
    'gr(ö|oe)(ß|ss)tenteils richtig',
    'irref(ü|ue)hrend',
  ],
  // The characters themselves, as the replacement half of an entity decoder:
  // `&bdquo;` becomes `„` in any language, and the rule in AGENTS.md that German
  // typography uses „…“ is what makes these the right output rather than a
  // German string.
  'lib/html.ts': ["'“'", "'„'"],
  // A field name in the JSON Yoast attaches to a WordPress post. It is spelled by
  // correctiv.org's plugin configuration, not by this app, and reading it with
  // any other spelling reads nothing.
  'services/wp.service.ts': ["'Geschätzte Lesezeit'"],
};

/** Every source file under a directory, at any depth. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|jsx|ts|mts|mjs|js)$/.test(entry) ? [full] : [];
  });
}

/**
 * The lines of a file that still carry German, once its excused fragments are
 * taken out of it. One occurrence each, deliberately: a fragment excused once and
 * pasted a second time in the same file is a second decision and shows up here.
 *
 * Comments go first, because a comment is not a string a user reads. The cost is
 * the app's too and is named there: a German COMMENT is invisible to this, and
 * has been a regression rather than a leftover since 2026-08-12.
 */
function germanLines(source: string, excused: string[]): string[] {
  let remaining = withoutComments(source);
  for (const fragment of excused) remaining = remaining.replace(fragment, '');
  return remaining
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => GERMAN_CHARACTERS.test(line));
}

describe('German lives in the catalogue', () => {
  const sources = sourceFiles(SRC)
    .map((full) => relative(SRC, full).split(sep).join('/'))
    .filter((path) => !CONTENT.test(path));

  const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

  it('reads the core it is checking (guards against a silently empty walk)', () => {
    expect(sources.length).toBeGreaterThan(25);
  });

  it('holds German in the catalogue, and in three inputs that say why not', () => {
    const german = sources
      .flatMap((path) =>
        germanLines(read(path), GERMAN_OUTSIDE_THE_CATALOGUE[path] ?? []).map(
          (line) => `${path}: ${line}`,
        ),
      )
      .sort();

    expect(german).toEqual([]);
  });

  it('excuses no German that has since been lifted', () => {
    const stale = Object.entries(GERMAN_OUTSIDE_THE_CATALOGUE).flatMap(([path, fragments]) =>
      fragments
        .filter((fragment) => !sources.includes(path) || !read(path).includes(fragment))
        .map((fragment) => `${path}: ${fragment}`),
    );

    expect(stale).toEqual([]);
  });

  it('excludes the content directory and nothing else', () => {
    // The exclusion is a path rule, so it is the one part of this file that can
    // widen by accident. Named here, so widening it is a visible edit.
    const excluded = sourceFiles(SRC)
      .map((full) => relative(SRC, full).split(sep).join('/'))
      .filter((path) => CONTENT.test(path));

    expect(excluded.every((path) => path.startsWith('data/'))).toBe(true);
    expect(excluded.length).toBeGreaterThan(0);
  });
});
