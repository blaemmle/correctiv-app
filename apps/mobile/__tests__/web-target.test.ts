import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Guards the web target against the one failure mode that does not announce
 * itself.
 *
 * react-native-webview has no web implementation. On web it renders the text
 * "React Native WebView does not support this platform." — and crucially,
 * `expo export --platform web` still succeeds, so a CI job that only checks the
 * export stays green while the route is broken. That is why this is a test and
 * not a comment.
 *
 * The rule: react-native-webview may only be imported from a file Metro
 * resolves exclusively on native. Anything else must go through
 * components/reader/ReaderView, which has a .web.tsx sibling.
 *
 * The file has since collected the rest of the import-shaped incidents in
 * TROUBLESHOOTING.md, because they share that shape: a green build, a green
 * typecheck, a green test run, and a broken app. One of them (`expo-router/tabs`)
 * is not web-only; it lives here because the guard is the same one line of regex
 * over the same file list, not because the failure is about the export.
 */
const SRC = resolve(__dirname, '../src');

/** Files Metro only ever picks on native — safe places for a native-only import. */
const NATIVE_ONLY = [/\.native\.[jt]sx?$/, /\.(android|ios)\.[jt]sx?$/];

/**
 * ReaderView.tsx is the native branch of a platform pair: Metro prefers
 * ReaderView.web.tsx on web, so the bare .tsx never reaches a browser. Verified
 * below by asserting the .web.tsx sibling exists.
 */
const PLATFORM_PAIRED = [
  'components/reader/ReaderView.tsx',
  // A foreign embed (YouTube). Same deal: .web.tsx renders a real <iframe>.
  'components/media/VideoFrame.tsx',
  // Not a native SDK this time but half a megabyte of base64: the bundled covers
  // are for an offline phone, and .web.ts keeps them out of the page.
  'lib/articles/covers.ts',
  // The screen header. Native configures the platform's stack header; on web
  // that header draws nothing at all — `ScreenStackHeaderConfig.web.js` makes it
  // and every subview a bare `View` — so .web.tsx keeps the app's drawn bar
  // (ADR 0030).
  'components/ui/ScreenHeader.tsx',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.[jt]sx?$/.test(entry) ? [full] : [];
  });
}

describe('web target', () => {
  const files = sourceFiles(SRC);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('imports react-native-webview only from native-only or platform-paired files', () => {
    const offenders = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (NATIVE_ONLY.some((p) => p.test(rel)) || PLATFORM_PAIRED.includes(rel)) return false;
      return /from\s+['"]react-native-webview['"]/.test(readFileSync(file, 'utf8'));
    });

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('gives every platform-paired file a .web counterpart', () => {
    for (const rel of PLATFORM_PAIRED) {
      const web = resolve(SRC, rel.replace(/\.(tsx?)$/, '.web.$1'));
      expect(statSync(web).isFile()).toBe(true);
    }
  });

  it('reaches the bundled covers only through the platform-paired module', () => {
    // Importing the generated module directly would put every data URI back into
    // the web export, and nothing about the page would look wrong — it would just
    // be half a megabyte heavier. Exactly the failure this file exists to catch.
    const offenders = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/articles/covers.ts') return false;
      return /from\s+'[^']*offlineCovers\.generated'/.test(readFileSync(file, 'utf8'));
    });

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('reaches the bundled articles and feeds only through the platform adapter', () => {
    // The sibling rule above, for the other generated module. `lib/platform/expo.ts`
    // is the one file that knows the bundle exists — that is what the `ContentBundle`
    // port is (ARCHITECTURE.md → The four ports, ADR 0006). A screen that imports it
    // directly gets a list that cannot go live, evaluated once at module scope, plus
    // 6000 lines of snapshots in its route's import graph. `(tabs)/profil.tsx` did.
    const offenders = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/platform/expo.ts') return false;
      return /from\s+'[^']*articles\/offlineBundle\.generated'/.test(readFileSync(file, 'utf8'));
    });

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('gives every dynamic route a generateStaticParams', () => {
    // `expo export --platform web` turns a route without it into a single
    // `[id].html`, so on a static host every real URL under it 404s. `/projekt/klima`
    // shipped that way while the build and every test stayed green
    // (TROUBLESHOOTING.md → The web target). Native never notices; it has no URLs.
    const dynamicRoutes = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      return rel.startsWith('app/') && /\[[^\]]+\]\.tsx$/.test(rel);
    });

    expect(dynamicRoutes.length).toBeGreaterThan(0);

    const offenders = dynamicRoutes.filter(
      (file) => !/export\s+function\s+generateStaticParams\b/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('never imports from expo-router/tabs', () => {
    // Importing `BottomTabBar` from there to build a custom tab bar pulls a second
    // React instance into the bundle and the app dies at startup with minified React
    // error #321, on every platform, while build, typecheck and tests stay green
    // (TROUBLESHOOTING.md → The web target). `(tabs)/_layout.web.tsx` carries the
    // comment; this is the part that fails.
    const offenders = files.filter((file) =>
      /from\s+['"]expo-router\/tabs['"]/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('keeps the font files out of the theme barrel', () => {
    // `lib/theme` is the app's most-imported module: a component asks it for
    // `useColors` and, through `export * from './fonts'`, used to get
    // `@expo-google-fonts/*` with it — five `require()`s of a `.ttf` in the import
    // graph of every component in the app. Metro dedupes those into its asset
    // registry, so nothing on a phone notices; a plain bundler emits every cut the
    // package re-exports, which measured 19,828 kB against 424 kB for a single
    // `<Typo>` built outside Metro (ADR 0027). The families a component actually
    // wants are plain strings in `lib/theme/fonts.ts`; the files are in
    // `font-assets.ts`, and `lib/env/fonts.ts` is the only module that has any use
    // for them — one importer, so that the second host loads the app's five cuts by
    // loading the app's environment rather than by transcribing a list of names
    // (ADR 0028).
    const barrel = readFileSync(resolve(SRC, 'lib/theme/index.ts'), 'utf8');
    expect(barrel).not.toMatch(/font-assets/);

    const expoFonts = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/theme/font-assets.ts') return false;
      return /from\s+'@expo-google-fonts\//.test(readFileSync(file, 'utf8'));
    });
    expect(expoFonts.map((f) => relative(SRC, f))).toEqual([]);

    const importers = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/env/fonts.ts') return false;
      return /from\s+'[^']*theme\/font-assets'/.test(readFileSync(file, 'utf8'));
    });
    expect(importers.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('routes both reader implementations through one shared props type', () => {
    // If these drift apart the platforms can diverge silently, so both must
    // import the contract rather than declare their own props inline.
    for (const variant of ['ReaderView.tsx', 'ReaderView.web.tsx']) {
      const source = readFileSync(resolve(SRC, 'components/reader', variant), 'utf8');
      expect(source).toMatch(/ReaderViewProps.*from\s+'\.\/types'/s);
    }
  });

  it('routes both screen-header implementations through one shared props type', () => {
    // The same rule as above, for the pair ADR 0030 added. This one carries more
    // than shape: the props type is where the two named exceptions are declared,
    // so a copy of it in one file would let the other accept a prop it cannot
    // honour.
    for (const variant of ['ScreenHeader.tsx', 'ScreenHeader.web.tsx']) {
      const source = readFileSync(resolve(SRC, 'components/ui', variant), 'utf8');
      expect(source).toMatch(/ScreenHeaderProps.*from\s+'\.\/screenHeaderTypes'/s);
    }
  });
});
