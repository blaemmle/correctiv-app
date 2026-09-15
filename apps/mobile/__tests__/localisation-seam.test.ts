import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';

import { de } from '@/i18n/catalogue/de';

/**
 * The localisation seam, and the two things about it that can rot silently.
 *
 * The shape, decided in
 * [ADR 0026](../../../adr/0026-react-native-review-and-hardening.md) §6: a message
 * descriptor's `defaultMessage` is ENGLISH and lives next to the component, the
 * German that ships is data in `src/i18n/catalogue/de/`, and `en.json` beside it
 * is generated from the source. German is the only language that ships.
 *
 * Both halves fail quietly on their own. A German entry deleted while its
 * descriptor stays renders the English default — a screen that still works, in
 * the wrong language, on a device nobody has. A German string written straight
 * into a screen never reaches a catalogue at all and is found by a translator
 * years later. Neither is visible to typecheck, lint or a screenshot, so it is
 * checked here, in the same `npm run check` as everything else. The shape is the
 * one `packages/app-core/test/boundary.test.ts` uses: walk the tree, collect the
 * offenders, assert the list is empty.
 */
const APP = resolve(__dirname, '..');
const SRC = join(APP, 'src');
const CATALOGUE = join(SRC, 'i18n', 'catalogue');
const GERMAN = join(CATALOGUE, 'de');
const ENGLISH = join(CATALOGUE, 'en.json');

/** `en.json` as `@formatjs/cli` writes it: one entry per id. */
interface Extracted {
  defaultMessage?: string;
  description?: string;
}

const english = JSON.parse(readFileSync(ENGLISH, 'utf8')) as Record<string, Extracted>;

/** Every file under a directory, at any depth. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe('every id exists on both sides', () => {
  it('finds messages at all (guards against a silently empty extraction)', () => {
    // An extraction that matched no file writes `{}`, and every assertion below
    // would pass over it.
    expect(Object.keys(english).length).toBeGreaterThan(0);
  });

  it('has a German string for every extracted id', () => {
    const missing = Object.keys(english).filter((id) => !de[id]?.trim());
    expect(missing).toEqual([]);
  });

  it('has an extracted id for every German string', () => {
    // The other direction, and the one that finds the leftovers: a message
    // renamed or deleted in a screen leaves its German behind, where it reads as
    // a translation somebody still needs.
    const orphans = Object.keys(de).filter((id) => !english[id]);
    expect(orphans).toEqual([]);
  });

  it('carries a non-empty English defaultMessage for every id', () => {
    const empty = Object.entries(english)
      .filter(([, message]) => !message.defaultMessage?.trim())
      .map(([id]) => id);
    expect(empty).toEqual([]);
  });

  it('keeps every id in the file its namespace names', () => {
    // `gate.headline` belongs in `de/gate.ts` and nowhere else. Without this the
    // directory is 26 files that happen to be merged, and the first hurried
    // migration puts a screen's strings wherever the file was already open.
    const misfiled: string[] = [];
    for (const file of readdirSync(GERMAN)) {
      if (file === 'index.ts') continue;
      const namespace = basename(file, '.ts');
      const module = require(join(GERMAN, file)) as Record<string, Record<string, string>>;
      const messages = module[namespace];
      expect(messages).toBeDefined();
      for (const id of Object.keys(messages)) {
        if (!id.startsWith(`${namespace}.`)) misfiled.push(`${file}: ${id}`);
      }
    }
    expect(misfiled).toEqual([]);
  });

  it('merges every namespace file into the catalogue', () => {
    // An empty namespace file contributes nothing to the merged object, so its
    // absence from the index cannot be seen there — but it is what the next agent
    // fills, and a file merged by nobody is a screen translated into a void.
    const index = readFileSync(join(GERMAN, 'index.ts'), 'utf8');
    const unmerged = readdirSync(GERMAN)
      .filter((file) => file !== 'index.ts')
      .map((file) => basename(file, '.ts'))
      .filter((namespace) => !index.includes(`from './${namespace}'`));
    expect(unmerged).toEqual([]);
  });
});

/**
 * The characters that betray a German string written outside the catalogue.
 *
 * A partial net on purpose, and the ADR says so: "Suchen" slips through, and no
 * cheap check catches it. What it does catch is most of them, for twenty lines.
 *
 * ~~and no false positives, because English prose in this repo has no use for any
 * of these — a comment quoting a German label uses straight quotes~~ The quotes
 * were the only half of that considered. Straight quotes do nothing about `ü`,
 * and the rule in [AGENTS.md](../../../AGENTS.md#language) that an English
 * sentence "leaves an identifier, a path and a command in their own spelling"
 * covers a quoted label too: four files explain a decision by naming the label it
 * is about — `Backstage · Früher lesen`, "Zurück", "im Browser öffnen" — and each
 * was on the migration list for a string that does not exist. Comments are
 * stripped before the test now, which is why they are not.
 */
const GERMAN_CHARACTERS = /[äöüßÄÖÜ„“]/;

/**
 * The file with its comments removed, because a comment is not a string a user
 * reads. Block comments go whole; a line comment goes when `//` opens the line,
 * which is the only shape this codebase writes and keeps `https://` inside a
 * string intact.
 *
 * The cost is real and worth naming: a comment written in German — a regression,
 * not a leftover, since 2026-08-12 — is now invisible here. It always was, since
 * every file this would have caught sat on the list below for a different reason.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * Bundled CONTENT rather than UI: the offline article and podcast snapshots, which
 * are CORRECTIV's own German journalism as `npm run offline-articles` fetched it.
 * Translating an article is not what this seam is for, and the reader's own copy
 * follows the same rule (ADR 0026 §6, on `packages/app-core/src/data/`).
 */
const CONTENT = new Set([
  'lib/articles/offlineBundle.generated.ts',
  'lib/podcasts/offlineBundle.generated.ts',
]);

/**
 * The gallery, which is a developer's catalogue of the components and is read by
 * nobody else. Its fixtures exist to show those components carrying the copy they
 * really carry, so translating them would make the preview lie and forcing them
 * to English would make it lie differently. Excluded by path rather than listed
 * below, because "not yet" is the wrong word: this one is never.
 */
const DEVELOPER_ONLY = /^gallery\//;

/**
 * The two German strings that are still written in code, and why each one is. Each
 * entry is the STRING, not the file it sits in: a whole-file exemption excuses
 * everything anybody adds to that file afterwards, which is a ratchet with one
 * entry instead of thirty-six.
 *
 * Asserted in both directions. German outside the catalogue that is not one of
 * these fails, and a string named here that the file no longer contains fails too
 * — so the reason has to be deleted with the string it was about, and cannot rot
 * into an excuse for something else.
 *
 * This was thirty-six files and the word for it was "not yet". It is two strings,
 * and the word is now "because" — so each one carries its reason, and a third
 * arriving without one is the thing to argue about.
 *
 * What this cannot do is the other half of a file. The net is partial (see
 * `GERMAN_CHARACTERS`), so the four German strings beside the excused one in
 * `RecoveryScreen.tsx` carry no umlaut and are invisible here whatever this list
 * says. They are covered by the same reason and named in that file.
 */
const GERMAN_OUTSIDE_THE_CATALOGUE: Record<string, string[]> = {
  // A channel's name, `CORRECTIV im Gespräch`. Marks get no id (a mark is not
  // translated), and an id would not help: a descriptor's `defaultMessage` would
  // BE the German spelling and would sit in this file all the same. The ways out
  // are a display name in the feed configuration or a line-level exception here,
  // and neither is worth doing before a second channel needs one.
  'app/(tabs)/mediathek.tsx': ['CORRECTIV im Gespräch'],
  // `useIntl()` throws here. The recovery screen is rendered BY the error
  // boundary, and expo-router's `Try` wraps the root route's default export — so
  // the boundary sits above `RootLayout`, and the `IntlProvider` that
  // `AppEnvironment` mounts is inside the subtree being caught. Measured, not
  // assumed: adding `useIntl()` to this screen fails 7 of the 8 cases in
  // `error-boundary.test.tsx` with "Could not find required `intl` object".
  // Moving the provider above the boundary would fix it and would also put the
  // catalogue between a crash and the screen that reports it, which is the wrong
  // trade for the one screen that has to render when everything else did not.
  'components/recovery/RecoveryScreen.tsx': [
    'Die App konnte diesen Bildschirm nicht anzeigen. Bitte versuchen Sie es noch einmal. Bleibt der Fehler, schließen Sie die App und öffnen Sie sie neu.',
  ],
};

/**
 * The lines of a file that still carry German, once its excused strings are taken
 * out of it.
 *
 * One occurrence each, deliberately: a string excused once and then pasted a
 * second time in the same file is a second decision and shows up here.
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
  /** Every file under `src/`, as a path relative to it, with `/` on every OS. */
  const sources = filesUnder(SRC)
    .map((full) => relative(SRC, full).split(sep).join('/'))
    .filter(
      (path) =>
        !path.startsWith('i18n/catalogue/de/') && !CONTENT.has(path) && !DEVELOPER_ONLY.test(path),
    );

  const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

  it('reads the app it is checking (guards against a silently empty walk)', () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  it('holds German in the catalogue, and in two strings that say why not', () => {
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
    // The other direction, and the one a one-sided allow-list cannot do: a string
    // that has moved into the catalogue leaves its reason behind, where the next
    // reader takes it for a rule about the file.
    const stale = Object.entries(GERMAN_OUTSIDE_THE_CATALOGUE).flatMap(([path, fragments]) =>
      fragments
        .filter((fragment) => !sources.includes(path) || !read(path).includes(fragment))
        .map((fragment) => `${path}: ${fragment}`),
    );

    expect(stale).toEqual([]);
  });
});

/**
 * The name a block of descriptors goes under.
 *
 * Three authors migrated this app in one pass and left eight names for one thing:
 * `COPY`, `TABS`, `HEADER_COPY`, `MESSAGES`, `NO_ACCESS`, `STAGE`, `SOURCE_LABELS`
 * and `TIER_LABELS`. None of them is wrong on its own, which is the problem — the
 * cost is paid by the next person, who has to open the file to find out what the
 * words in it are called, and by the one after that, who invents a ninth.
 *
 * Two kinds, so two names, and [AGENTS.md](../../../AGENTS.md#language) says which:
 *
 *  - `COPY`, the words a file writes in its own voice, one per file. A block
 *    another file IMPORTS takes the name of what it belongs to instead
 *    (`HEADER_COPY`, `SALON5_RADIO_COPY`), because the importer has a `COPY` of
 *    its own and two of them cannot both be called that.
 *  - `<DOMAIN>_LABELS`, a `Record<DomainValue, MessageDescriptor>` the call site
 *    indexes with a value rather than reads top to bottom: `TIER_LABELS`,
 *    `SOURCE_LABELS`, `STAGE_LABELS`, `FAILURE_LABELS`. Not a block of copy, and
 *    naming it `COPY` would hide the one thing worth knowing about it.
 */
const CONTAINER = /^(COPY|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:LABELS|COPY))$/;

describe('descriptors live under one name', () => {
  it('names every `defineMessages` block COPY or <DOMAIN>_LABELS', () => {
    const offenders = filesUnder(SRC)
      .filter((full) => /\.tsx?$/.test(full))
      .flatMap((full) =>
        [...readFileSync(full, 'utf8').matchAll(/\bconst (\w+)(?::[^=]+)? = defineMessages\(/g)]
          .filter(([, name]) => !CONTAINER.test(name))
          .map(([, name]) => `${relative(SRC, full).split(sep).join('/')}: ${name}`),
      );

    expect(offenders).toEqual([]);
  });
});

describe('the extracted English catalogue is current', () => {
  /**
   * `en.json` is generated, so it goes stale the moment a descriptor is edited
   * without `npm run i18n:extract` — and stale is invisible: the app renders the
   * German catalogue and never reads this file. The check is the one
   * `packages/design-tokens/test/drift.test.ts` makes for the tokens: run the
   * generator and compare. It costs ~0.3 s, which is why it is here rather than a
   * step of its own in CI.
   *
   * The command is READ from `package.json` rather than repeated, with its output
   * redirected to a temporary file: a copy here would be the second place to keep
   * in step, and the committed artefact must not be rewritten by the test that
   * judges it.
   */
  it('is what `npm run i18n:extract` produces right now', () => {
    const script = (
      JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts['i18n:extract'];
    const out = 'src/i18n/catalogue/en.json';
    expect(script).toContain(out);

    const fresh = join(mkdtempSync(join(tmpdir(), 'i18n-')), 'en.json');
    execSync(script.replace(out, fresh), {
      cwd: APP,
      // npm puts the workspace's binaries on PATH; jest does not.
      env: {
        ...process.env,
        PATH: `${resolve(APP, '../../node_modules/.bin')}:${process.env.PATH}`,
      },
    });

    expect(readFileSync(ENGLISH, 'utf8')).toEqual(readFileSync(fresh, 'utf8'));
  });
});
