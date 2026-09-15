import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Keeps the component gallery honest.
 *
 * The catalogue is written by hand (`src/gallery/catalogue.tsx` says why: a
 * `require.context` would stay current and could not know what props to pass).
 * So a new component simply does not appear in the gallery, and the gallery
 * still looks complete, because it is a long page either way. This test names
 * the component that is missing.
 *
 * The catalogue is read as text rather than imported, because importing it pulls
 * in every component in the app and the `.tsx` transform for all of them, to
 * answer a question about a list of names.
 */
const APP = resolve(__dirname, '..');
const COMPONENTS = resolve(APP, 'src/components');

/**
 * Not components: shared prop contracts, the barrel, and the header's drawn bar.
 *
 * `ScreenHeaderBar` is what `ScreenHeader` draws on web and on the two screens
 * that keep the bar on every platform (ADR 0030). It is one drawing with one
 * entry, and the entry is `ScreenHeader`, because that is the component a screen
 * asks for and the address `tools/figma-plugin` and the handbook already use.
 */
const NOT_A_COMPONENT = new Set([
  'ui/index.ts',
  'media/videoFrameTypes.ts',
  'reader/types.ts',
  'ui/screenHeaderTypes.ts',
  'ui/ScreenHeaderBar.tsx',
]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

/**
 * Every component in `src/components`, as `folder` plus exported name.
 *
 * The name is the file's, and a `.web` or `.native` sibling is the same
 * component with a second implementation, so the platform suffix is dropped and
 * the pair counts once — `ReaderView` is one entry in the gallery, not two.
 */
function components(): { folder: string; name: string }[] {
  const seen = new Map<string, { folder: string; name: string }>();
  for (const file of files(COMPONENTS)) {
    const rel = relative(COMPONENTS, file).replaceAll('\\', '/');
    if (NOT_A_COMPONENT.has(rel)) continue;
    const match = /^([^/]+)\/([^/.]+)(?:\.(?:web|native|android|ios))?\.tsx$/.exec(rel);
    if (!match) continue;
    const [, folder, name] = match;
    seen.set(`${folder}/${name}`, { folder, name });
  }
  return [...seen.values()];
}

describe('component gallery', () => {
  const catalogue = readFileSync(resolve(APP, 'src/gallery/catalogue.tsx'), 'utf8');
  const found = components();

  it('finds the components to check', () => {
    // A resolution fault or a moved directory would otherwise make this whole
    // suite pass by having nothing to say.
    expect(found.length).toBeGreaterThan(40);
  });

  it('lists every component in src/components', () => {
    const missing = found.filter(({ name }) => !new RegExp(`name: '${name}'`).test(catalogue));

    expect(missing.map((c) => `${c.folder}/${c.name}`)).toEqual([]);
  });

  it('groups them under the folder they live in', () => {
    const folders = [...new Set(found.map((c) => c.folder))];
    const missing = folders.filter((f) => !new RegExp(`folder: '${f}'`).test(catalogue));

    expect(missing).toEqual([]);
  });
});
