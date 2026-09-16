/**
 * What each view of this site offers the shell, declared before it renders.
 *
 * The shell used to ask the page. `App.tsx` special-cased the workbench seven
 * times and decided the right sidebar from two booleans, which meant the panel's
 * existence was known only after the page had rendered something — so the toggle
 * and the default-open state were right one commit late, and the workbench was a
 * second site rather than a view. Here the **route declares and the page fills**:
 * the table below says which sections a view has, the page supplies their content
 * through `shell/slots.tsx`, and `test/shell.test.ts` fails when the two disagree.
 *
 * Pure data on purpose, no React and no icon. `test/shell.test.ts` imports this
 * file to check every route in the site against it, and a test that had to pull
 * the page tree in to ask about a string is a test that stops being run. The
 * icons live beside the chrome that draws them, in `ui/Section.tsx`, keyed by the
 * same type, so a section with a title and no icon is a type error.
 */

/** Every place a page can put something the shell draws. */
export type SectionId =
  // Shared: the in-page contents, which every long view has.
  | 'contents'
  // /workbench
  | 'appearance'
  | 'state'
  | 'console'
  | 'tokens'
  | 'measure'
  | 'inspect'
  // /design
  | 'design-links'
  | 'design-clients'
  | 'design-code'
  // /components/<group>/<name>
  | 'rendering'
  | 'device'
  | 'props'
  | 'source';

export type ViewKind =
  | 'landing'
  | 'handbook'
  | 'document'
  | 'diagrams'
  | 'diagram'
  | 'reference'
  | 'sources'
  | 'decisions'
  | 'design'
  | 'components'
  | 'component'
  | 'workbench'
  | 'not-found';

export interface ViewDeclaration {
  kind: ViewKind;
  /** Right panel sections, in order. Empty: no panel, no toggle, no ⌘J. */
  sections: readonly SectionId[];
  /** Which of them start open. A subset of `sections`. */
  openByDefault: readonly SectionId[];
  /** Whether the panel starts open: true where there is a tool to reach for. */
  panelOpenByDefault: boolean;
  /** The header names the panel this; `null` exactly when `sections` is empty. */
  panelTitle: string | null;
  /** Docked width. A heading list wants a fifth, a console wants a third. */
  panelWidth: '19%' | '24%' | '31%';
  /** A strip above the sections that does not scroll with them. */
  panelHead: boolean;
  /** Whether the header's context bar is filled by this view. */
  contextBar: boolean;
  /** Whether the status line is this view's rather than the file or the title. */
  statusBar: boolean;
  /** Whether `full=1` means anything here: a view whose main area is a drawing. */
  canGoFull: boolean;
  /**
   * Below the wide breakpoint: `'drawer'` is the sheet over the page, `'page'`
   * renders the sections inline underneath it and shrinks the frame to a button.
   */
  narrow: 'drawer' | 'page';
  /**
   * And whether it arrives there already full, rather than offering the button.
   *
   * True for the workbench alone, which is what it has always done below 1024:
   * the chrome is most of a 390px screen and the app is what the link was for.
   * The design and component views keep their prose at that size, so there the
   * button is the honest control.
   */
  fullWhenNarrow: boolean;
}

/** No panel: a landing page, an index, a set of doors. */
function plain(kind: ViewKind): ViewDeclaration {
  return {
    kind,
    sections: [],
    openByDefault: [],
    panelOpenByDefault: false,
    panelTitle: null,
    panelWidth: '19%',
    panelHead: false,
    contextBar: false,
    statusBar: false,
    canGoFull: false,
    narrow: 'drawer',
    fullWhenNarrow: false,
  };
}

/** A long read: the contents, shut, because there is no tool to reach for. */
function reading(kind: ViewKind, contextBar = false): ViewDeclaration {
  return {
    ...plain(kind),
    sections: ['contents'],
    openByDefault: ['contents'],
    panelTitle: 'On this page',
    contextBar,
  };
}

export const VIEWS: Record<ViewKind, ViewDeclaration> = {
  landing: plain('landing'),
  handbook: plain('handbook'),
  diagrams: plain('diagrams'),
  'not-found': plain('not-found'),
  // A drawing and its caption. Its headings carry no ids, so a contents list
  // here would be an empty box behind a toggle, which is decision 4's case.
  diagram: plain('diagram'),

  document: reading('document'),
  sources: reading('sources'),
  decisions: reading('decisions'),
  // The filter moves out of the page body and into the header's context bar, so
  // a lookup surface keeps its filter on screen without a second sticky thing
  // inside a scroller that is already sticky.
  reference: reading('reference', true),
  components: reading('components', true),

  design: {
    kind: 'design',
    sections: ['design-links', 'design-clients', 'design-code'],
    openByDefault: ['design-links', 'design-clients', 'design-code'],
    panelOpenByDefault: true,
    panelTitle: 'Design tools',
    // Four download cards and three pointer cards need more than a heading list
    // and less than a console, and a third would leave the Figma frame half the
    // window at 1280.
    panelWidth: '24%',
    panelHead: false,
    contextBar: true,
    statusBar: false,
    canGoFull: true,
    narrow: 'page',
    fullWhenNarrow: false,
  },

  component: {
    kind: 'component',
    sections: ['rendering', 'device', 'props', 'source'],
    // `source` shut: the prose is long for the components that have it, and a
    // reader who came to look at the thing should see the thing first.
    openByDefault: ['rendering', 'device', 'props'],
    panelOpenByDefault: true,
    panelTitle: 'Component',
    panelWidth: '31%',
    panelHead: false,
    contextBar: true,
    statusBar: true,
    canGoFull: true,
    narrow: 'page',
    fullWhenNarrow: false,
  },

  workbench: {
    kind: 'workbench',
    sections: ['appearance', 'state', 'console', 'tokens', 'measure', 'inspect'],
    openByDefault: ['appearance', 'console', 'measure'],
    /*
     * Shut, although this is the view with the most tools on it.
     *
     * `RELEASE.md` hands out this address to people who want to see the app, and
     * `tools=1` exists precisely so that somebody debugging can opt in and send
     * the opened state as a link. Design and component open instead, because a
     * reader arrives at those to use the panel rather than to look past it.
     */
    panelOpenByDefault: false,
    panelTitle: 'Tools',
    panelWidth: '31%',
    panelHead: true,
    contextBar: true,
    statusBar: true,
    canGoFull: true,
    narrow: 'page',
    fullWhenNarrow: true,
  },
};

/**
 * What a section is called, wherever it is drawn.
 *
 * Here rather than passed by the page, because the id is in the URL under
 * `open=`: a page that could rename its own section would be renaming something
 * a link already refers to.
 */
export const SECTION_TITLES: Record<SectionId, string> = {
  contents: 'On this page',
  appearance: 'Appearance',
  state: 'State',
  console: 'Console',
  tokens: 'Tokens',
  measure: 'Measure',
  inspect: 'Inspect',
  'design-links': 'Open',
  'design-clients': 'Desktop clients',
  'design-code': 'Where it reaches the code',
  rendering: 'Rendering',
  device: 'Device',
  props: 'Props',
  source: 'Source',
};

export interface ResolvedView {
  view: ViewDeclaration;
  /** `/components/ui/Card` gives `{ group: 'ui', name: 'Card' }`. */
  params: Record<string, string>;
}

/** The views answered with a component of this site rather than with a document. */
const EXACT: Record<string, ViewKind> = {
  '/': 'landing',
  '/handbook': 'handbook',
  '/diagrams': 'diagrams',
  '/reference': 'reference',
  '/sources': 'sources',
  '/decisions': 'decisions',
  '/design': 'design',
  '/components': 'components',
  '/workbench': 'workbench',
};

/** Every route this site answers with a page of its own, for the tests and the palette. */
export const PAGE_ROUTES: readonly string[] = Object.keys(EXACT);

/**
 * Which view a route is, and what it was given.
 *
 * `isDocument` and `hasComponent` are passed in rather than read, so this file
 * imports no virtual module and a test can call it with lists it built itself.
 *
 * Exact matches first, then the two families with a segment under them, then the
 * documents. The order is what lets `/design` be a page and `/design/plugin` a
 * document without either shadowing the other; `test/shell.test.ts` holds that
 * pair specifically, because the last time a page and a document wanted one
 * address the document simply left the site with no error anywhere.
 *
 * **A component the app has not got is not the component view.** The declaration
 * is what the shell believes before the page renders, so an address like
 * `/components/ui/NotAThing` used to open a panel with `Rendering`, `Device`,
 * `Props` and `Source` in it and nothing inside any of them, plus a blank status
 * line — four empty boxes behind four titles, which is what a declaration costs
 * when nothing can fill it. `test/shell.test.ts` reads the page files as text and
 * cannot see that, because the slots are in the file and the render returned
 * before them. Asking here is where the question can be answered once.
 */
export function resolveView(
  route: string,
  isDocument: boolean,
  hasComponent: (group: string, name: string) => boolean = () => true,
): ResolvedView {
  const exact = EXACT[route];
  if (exact) return { view: VIEWS[exact], params: {} };

  if (route.startsWith('/diagrams/')) {
    return { view: VIEWS.diagram, params: { id: route.slice('/diagrams/'.length) } };
  }

  if (route.startsWith('/components/')) {
    const [group, name, ...rest] = route.slice('/components/'.length).split('/');
    if (group && name && rest.length === 0 && hasComponent(group, name)) {
      return { view: VIEWS.component, params: { group, name } };
    }
  }

  if (isDocument) return { view: VIEWS.document, params: {} };

  return { view: VIEWS['not-found'], params: {} };
}
