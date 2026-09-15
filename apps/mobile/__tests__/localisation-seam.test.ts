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
 * cheap check catches it. What it does catch is most of them, for twenty lines
 * and no false positives, because English prose in this repo has no use for any
 * of these — a comment quoting a German label uses straight quotes
 * ([AGENTS.md](../../../AGENTS.md#language)).
 */
const GERMAN_CHARACTERS = /[äöüßÄÖÜ„“]/;

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
 * The screens whose German has not been lifted yet, and the reason this check can
 * pass today at all.
 *
 * ADR 0026 §6 asks for no German under `apps/mobile/src` outside the catalogue.
 * That is the end state and it is 36 files away: the app was written in German
 * and one screen has moved. So the rule is enforced as a ratchet instead — this
 * list is asserted EXACTLY, so a new German string in a file that is not on it
 * fails, and a migrated screen still named here fails too. Migrating a screen
 * deletes its line. When the last line goes, the assertion below is literally
 * what the ADR wrote and this list can go with it.
 */
const NOT_YET_MIGRATED = [
  'app/+not-found.tsx',
  'app/(tabs)/mediathek.tsx',
  'app/(tabs)/mitmachen.tsx',
  'app/(tabs)/profil.tsx',
  'app/artikel.tsx',
  'app/atlas.tsx',
  'app/aufruf/[slug].tsx',
  'app/backstage.tsx',
  'app/behauptung/[id].tsx',
  'app/einstellungen.tsx',
  'app/faktenforum.tsx',
  'app/formular.tsx',
  'app/onboarding.tsx',
  'app/player.tsx',
  'app/projekt/[id].tsx',
  'app/serie/[id].tsx',
  'app/suche.tsx',
  'app/tagebuch/[id].tsx',
  'app/video.tsx',
  'components/discover/SearchEntry.tsx',
  'components/home/EarlyAccessCard.tsx',
  'components/home/ImpactFooter.tsx',
  'components/home/MediathekReihe.tsx',
  'components/media/LiveBanner.tsx',
  'components/participate/FormField.tsx',
  'components/player/MiniPlayer.tsx',
  'components/recovery/RecoveryScreen.tsx',
  'components/ui/Badge.tsx',
  'components/ui/Overline.tsx',
  'components/ui/ScreenHeader.tsx',
  'components/ui/ScreenHeaderBar.tsx',
  'components/ui/screenHeaderTypes.ts',
  'gallery/catalogue.tsx',
  'gallery/fixtures.ts',
  'lib/articles/articleUrl.ts',
  'lib/participate/calloutStyle.ts',
];

describe('German lives in the catalogue', () => {
  /** Every file under `src/`, as a path relative to it, with `/` on every OS. */
  const sources = filesUnder(SRC)
    .map((full) => relative(SRC, full).split(sep).join('/'))
    .filter((path) => !path.startsWith('i18n/catalogue/de/') && !CONTENT.has(path));

  const german = sources
    .filter((path) => GERMAN_CHARACTERS.test(readFileSync(join(SRC, path), 'utf8')))
    .sort();

  it('reads the app it is checking (guards against a silently empty walk)', () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  it('holds German in the catalogue and in the screens still waiting for one', () => {
    // Exact, in both directions. A new German string outside the catalogue adds a
    // line here; a migrated screen removes one. Neither is allowed to pass
    // silently, which is what a one-directional allow-list would do.
    expect(german).toEqual([...NOT_YET_MIGRATED].sort());
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
