import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';

import { withoutComments } from './support/source';

/**
 * Nothing gets forgotten: the catalogue, held against the components that exist.
 *
 * `src/gallery/catalogue.tsx` is written by hand, and that file says why — a
 * `require.context` over the folder would stay current on its own and could not
 * know what props to pass, and `<ArticleHero>` with no item is an empty box.
 * What it costs is that a component added today reaches nobody's overview until
 * somebody remembers, and nothing about a long page looks short.
 *
 * **One list, three readers.** The catalogue is the app's own gallery, it is the
 * roster `apps/handbook/src/components/direct.tsx` draws from
 * ([ADR 0027](../../../adr/0027-the-handbook-draws-the-apps-components.md),
 * [ADR 0028](../../../adr/0028-one-shell-and-a-route-that-declares-its-context.md)),
 * and `?c=` carries its ids between the two sites. So a component missing here is
 * missing from three places at once, and the handbook cannot notice: its own
 * check reads this list and is only as complete as this list is.
 *
 * Read as TEXT rather than imported, which is the same split
 * `apps/handbook/test/direct.test.ts` makes: importing the catalogue pulls in
 * every component in the app and the `.tsx` transform for all of them, to answer
 * a question about a list of names.
 */
const APP = resolve(__dirname, '..');
const COMPONENTS = resolve(APP, 'src/components');
const CATALOGUE = resolve(APP, 'src/gallery/catalogue.tsx');

/**
 * **What counts as a component**: a PascalCase value exported from a `.tsx` file
 * under `src/components`, addressed as `folder/Name`.
 *
 * Three lines drawn, each for a reason that can be checked rather than argued:
 *
 *  - **The export, not the file.** `VideoFrame.web.tsx` exports `VideoFrame`,
 *    because the suffix is Metro's and not the caller's, so a platform split
 *    collapses to one address without a suffix rule — which is what the gallery
 *    needs, since it draws whichever half the bundler kept and cannot say which.
 *    A file that exports two components is two components here, and the test
 *    below refuses that anyway.
 *  - **`.tsx`, not `.ts`.** JSX in a `.ts` file is a typecheck error, so a `.ts`
 *    file under this folder renders nothing — the barrel and the three shared
 *    prop types (`reader/types.ts`, `media/videoFrameTypes.ts`,
 *    `ui/screenHeaderTypes.ts`) are excluded by the extension and need no
 *    exception of their own. This was four names on an exception list, which is
 *    four lines that grow with the folder and excuse whatever is added to those
 *    files later. `hides no component in a .ts file` below keeps the extension a
 *    rule rather than an assumption.
 *  - **PascalCase, and it must contain a lower-case letter.** `sampleTarget` is
 *    callable and lower case; `HEADER_COPY` and `READER_BASE_URL` are capitalised
 *    and are not components. `apps/handbook/scripts/api.mjs` draws the same line
 *    with a real type graph — "a capitalised callable", `componentSignature` —
 *    and it is the same line for the same reason: nothing under `src/components`
 *    is both callable and capitalised except a component. This check reads
 *    spelling instead of callability, so it errs towards noticing: a PascalCase
 *    export that is not a component has to be catalogued or excused, and that is
 *    a conversation rather than a silence.
 */
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const EXPORTED_VALUE = /^export (?:function|const) (\w+)/gm;
/** `ReaderView.web.tsx` is `ReaderView`'s second implementation, not a second one. */
const PLATFORM_SUFFIX = /\.(web|native|ios|android)$/;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

/** Path under `src/components`, with `/` on every OS. */
const under = (path: string) => relative(COMPONENTS, path).split(sep).join('/');

/** The PascalCase values a file exports, comments taken out first. */
function exportedComponents(source: string): string[] {
  return [...withoutComments(source).matchAll(EXPORTED_VALUE)]
    .map(([, name]) => name)
    .filter((name) => PASCAL_CASE.test(name) && /[a-z]/.test(name));
}

interface Declared {
  /** `folder/Name`: the app's own address, `componentId` in the catalogue. */
  id: string;
  /** Path under `src/components`, so a failure names a file to open. */
  file: string;
  name: string;
}

function declaredComponents(): Declared[] {
  return filesUnder(COMPONENTS)
    .map(under)
    .filter((file) => file.endsWith('.tsx'))
    .flatMap((file) => {
      // A file directly under `src/components` has no folder over it. There is
      // none today; one added tomorrow gets the address `components/Name` here
      // and in the handbook's reference, which uses the same fallback.
      const folder = file.includes('/') ? file.slice(0, file.indexOf('/')) : 'components';
      return exportedComponents(readFileSync(join(COMPONENTS, file), 'utf8')).map((name) => ({
        id: `${folder}/${name}`,
        file,
        name,
      }));
    });
}

/**
 * `folder/Name` for every entry in the catalogue, in the order it writes them.
 *
 * The scan is ordered rather than structural: each `name:` belongs to the last
 * `folder:` above it, which is what the file's own shape says. `Entry`'s
 * declaration (`name: string`) and `componentId`'s parameters carry no quote and
 * are not entries.
 */
function cataloguedIds(source: string): string[] {
  const ids: string[] = [];
  let folder = '';
  for (const [, key, value] of withoutComments(source).matchAll(/\b(folder|name): '([^']+)'/g)) {
    if (key === 'folder') folder = value;
    else ids.push(`${folder}/${value}`);
  }
  return ids;
}

interface Excused {
  /**
   * Why this component is not an entry of its own, in the words of what was
   * measured. A path with no reason beside it is an amnesty: the next person
   * reads a list of names, cannot tell which of them were argued and which were
   * merely added, and adds one more.
   */
  why: string;
  /**
   * The entry that draws it instead, where there is one. Asserted below, both
   * that the entry exists and that the catalogue still names this component — so
   * a reason cannot outlive the drawing it points at.
   */
  drawnBy?: string;
}

/**
 * The components with no entry of their own, and why each one has none.
 *
 * One today. Asserted in both directions: a component that is neither catalogued
 * nor here fails, and an entry here that has since been catalogued, or whose
 * component has since been deleted, fails too.
 */
const NOT_AN_ENTRY_OF_ITS_OWN: Record<string, Excused> = {
  // Read off the two `ScreenHeader` files and the catalogue's own comment: on iOS
  // and Android `ScreenHeader` configures the platform's stack header and draws
  // nothing (ADR 0030), and calling `Stack.Screen` from inside a gallery card
  // would set the options of the route the gallery is on. So the `ui/ScreenHeader`
  // entry draws THIS file, which is the whole of what there is to look at, and a
  // second entry would be the same picture under the name no screen asks for.
  'ui/ScreenHeaderBar': {
    why: 'Drawn under `ui/ScreenHeader`, which is the name a screen asks for: the bar is what `ScreenHeader` renders on web and on the two screens that keep it everywhere, and on native `ScreenHeader` draws nothing at all.',
    drawnBy: 'ui/ScreenHeader',
  },
};

/**
 * **What a green run here does NOT mean**, at the top of the assertions rather
 * than at the bottom of the file, because a check that says what it cannot see is
 * the only kind that can be trusted about what it can.
 *
 * This holds a list of NAMES against a folder of files. It says every component
 * has an entry; it says nothing about whether the entry shows anything. A
 * specimen built with the wrong props, one that renders an empty box, a
 * component listed with `specimens: []` — all of those pass here and are visible
 * only to somebody looking at the gallery or at `/workbench`. ADR 0027's rule
 * applies to this check as much as to the handbook's drawing: where two
 * renderings disagree the app's is right, and nothing automatic compares them.
 *
 * Four more blind spots, each a PR to have rather than a pattern to widen:
 *
 *  - **A component that is not under `src/components`.** A screen in `src/app/`
 *    that grew into a component, a wrapper in `src/lib/` — out of scope by
 *    construction, and the scope is the folder rather than the shape.
 *  - **A component built without JSX.** `createElement` in a `.ts` file is a
 *    component this reads as a helper; `hides no component in a .ts file` below
 *    closes the spelling that a person would actually write, and not this one.
 *  - **A re-export.** `export { X } from './X'` is matched nowhere here, which is
 *    right for the barrel and would be wrong for a component declared by a name
 *    of its own and published under another.
 *  - **A `name: '…'` written inside a specimen's label**, which this would read
 *    as an entry, and the `//`-inside-a-string limit every check built on
 *    `support/source.ts` inherits (it is written down beside the helper).
 */
describe('the gallery catalogue holds every component', () => {
  const declared = declaredComponents();
  const source = readFileSync(CATALOGUE, 'utf8');
  const catalogued = cataloguedIds(source);
  const declaredIds = new Set(declared.map(({ id }) => id));
  const cataloguedIdSet = new Set(catalogued);

  it('reads the components it is checking (guards against a silently empty walk)', () => {
    // A moved directory or a resolution fault would otherwise make this whole
    // suite pass by having nothing to say.
    expect(declared.length).toBeGreaterThan(40);
  });

  it('reads the catalogue it is checking (guards against a silently empty parse)', () => {
    // The parse is over text, so a rename of `folder:` or `name:` in the
    // catalogue's own shape would empty this list rather than break it.
    expect(catalogued.length).toBeGreaterThan(40);
    expect(new Set(catalogued.map((id) => id.split('/')[0])).size).toBeGreaterThan(5);
  });

  it('has an entry for every component in src/components', () => {
    const missing = declared
      .filter(({ id }) => !cataloguedIdSet.has(id) && !(id in NOT_AN_ENTRY_OF_ITS_OWN))
      .map(({ id, file }) => `${id} (${file})`);

    expect(missing.sort()).toEqual([]);
  });

  it('has a component for every entry', () => {
    // The direction a one-sided list cannot do, and the one that catches a
    // deleted component, a renamed one, and an entry filed under the wrong
    // folder — which the address makes the same mistake as a missing one.
    const stale = catalogued.filter((id) => !declaredIds.has(id));

    expect(stale.sort()).toEqual([]);
  });

  it('lists no component twice', () => {
    // Two entries for one address is the copy-paste that neither direction above
    // can see: both halves agree, and the gallery draws the component twice.
    const duplicates = catalogued.filter((id, index) => catalogued.indexOf(id) !== index);

    expect(duplicates.sort()).toEqual([]);
  });

  it('keeps one component per file, named after its file', () => {
    // The address depends on it. `apps/handbook/scripts/api.mjs` prints a
    // component's import line as the folder's barrel or `@/components/<folder>/<name>`,
    // so a second component inside `Card.tsx` gets an import path that does not
    // resolve, and `?c=` gets an id no source link can answer.
    const misnamed = declared
      .filter(({ file, name }) => basename(file, '.tsx').replace(PLATFORM_SUFFIX, '') !== name)
      .map(({ file, name }) => `${file}: ${name}`);

    expect(misnamed.sort()).toEqual([]);
  });

  it('hides no component in a .ts file', () => {
    // What makes the extension rule above a rule rather than an assumption: a
    // `.ts` file here declares types or re-exports, and a PascalCase value
    // exported from one is a component the walk would never see.
    const hidden = filesUnder(COMPONENTS)
      .map(under)
      .filter((file) => file.endsWith('.ts'))
      .flatMap((file) =>
        exportedComponents(readFileSync(join(COMPONENTS, file), 'utf8')).map(
          (name) => `${file}: ${name}`,
        ),
      );

    expect(hidden.sort()).toEqual([]);
  });
});

describe('the components with no entry of their own', () => {
  const declared = declaredComponents();
  const source = readFileSync(CATALOGUE, 'utf8');
  const catalogued = new Set(cataloguedIds(source));
  const declaredIds = new Set(declared.map(({ id }) => id));

  it('excuses nothing that is not a component any more', () => {
    const gone = Object.keys(NOT_AN_ENTRY_OF_ITS_OWN).filter((id) => !declaredIds.has(id));

    expect(gone.sort()).toEqual([]);
  });

  it('excuses nothing the catalogue now lists', () => {
    // The reason has to be deleted with the exception it was about. An id that is
    // both excused and catalogued reads, to the next person, as a rule about the
    // component rather than as a leftover.
    const lifted = Object.keys(NOT_AN_ENTRY_OF_ITS_OWN).filter((id) => catalogued.has(id));

    expect(lifted.sort()).toEqual([]);
  });

  it('gives every exception a reason rather than a path', () => {
    const silent = Object.entries(NOT_AN_ENTRY_OF_ITS_OWN)
      .filter(([, { why }]) => why.trim().length < 20)
      .map(([id]) => id);

    expect(silent.sort()).toEqual([]);
  });

  it('holds every reason that names another entry against the catalogue', () => {
    const broken = Object.entries(NOT_AN_ENTRY_OF_ITS_OWN).flatMap(([id, { drawnBy }]) => {
      if (!drawnBy) return [];
      if (!catalogued.has(drawnBy)) return [`${id}: drawn by ${drawnBy}, which is gone`];
      // The entry exists; this is the half that says it still draws THIS
      // component, rather than merely sharing a name with the reason. A reason
      // that survives the drawing it points at is the exception going stale
      // without a single line of it changing.
      const name = id.slice(id.indexOf('/') + 1);
      return source.includes(name) ? [] : [`${id}: ${drawnBy} no longer draws it`];
    });

    expect(broken.sort()).toEqual([]);
  });
});
