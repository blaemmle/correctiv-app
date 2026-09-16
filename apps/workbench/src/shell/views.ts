/**
 * What each view of this site offers the shell, declared before it renders.
 *
 * The shell used to ask the page. `App.tsx` special-cased the preview seven
 * times and decided the right sidebar from two booleans, which meant the panel's
 * existence was known only after the page had rendered something — so the toggle
 * and the default-open state were right one commit late, and the preview was a
 * second site rather than a view. Here the **route declares and the page fills**:
 * the table below says which sections a view has, the page supplies their content
 * through `shell/slots.tsx`, and `test/shell.test.ts` fails when the two disagree.
 *
 * Pure data on purpose, no React and no icon. `test/shell.test.ts` imports this
 * file to check every route in the site against it, and a test that had to pull
 * the page tree in to ask about a string is a test that stops being run. The
 * icons live beside the chrome that draws them, in `ui/ToolRail.tsx`, keyed by
 * the same type, so a section with a title and no icon is a type error.
 */

/** Every place a page can put something the shell draws. */
export type SectionId =
  // Shared: the in-page contents, which every long view has.
  | 'contents'
  // /preview
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
  | 'preview'
  | 'not-found';

export interface ViewDeclaration {
  kind: ViewKind;
  /**
   * What the right panel can show, in the order the rail lists them.
   *
   * **One at a time.** These used to be a stack of collapsible sections sharing
   * one column, which on `/preview` meant six of them inside thirty-one per cent
   * of the window: each got a sliver, and each needed a caption saying what the
   * sliver was. The rail on the right edge opens one of them at the panel's full
   * height, and pressing the open one shuts the panel — so there is one switch
   * where there used to be a header button, a close button and six chevrons.
   * ([ADR 0038](../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
   *
   * Empty: no panel, no rail, no ⌘J.
   */
  sections: readonly SectionId[];
  /** The rail and the panel are named this; `null` exactly when `sections` is empty. */
  panelTitle: string | null;
  /** Docked width. A heading list wants a fifth, a console wants a third. */
  panelWidth: '19%' | '24%' | '31%';
  /** Whether the header's context bar is filled by this view. */
  contextBar: boolean;
  /** Whether the status line is this view's rather than the file or the title. */
  statusBar: boolean;
  /** Whether `full=1` means anything here: a view whose main area is a drawing. */
  canGoFull: boolean;
  /**
   * And whether it arrives there already full, rather than offering the button.
   *
   * True for the preview alone, which is what it has always done below 1024:
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
    panelTitle: null,
    panelWidth: '19%',
    contextBar: false,
    statusBar: false,
    canGoFull: false,
    fullWhenNarrow: false,
  };
}

/**
 * A long read, whose one rail entry is its contents.
 *
 * **A table of contents is not a tool**, and the rail does not dress it up as
 * one: it is a single icon, it is called `On this page`, and it is there because
 * the panel needs a switch and the edge the panel opens from is where that switch
 * belongs. What the reading views get out of the rail is not a tool box, it is
 * that the contents are in the same place on every view of this site.
 */
function reading(kind: ViewKind, contextBar = false): ViewDeclaration {
  return {
    ...plain(kind),
    sections: ['contents'],
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
  // here would be an empty box behind a rail icon, which is decision 4's case.
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
    panelTitle: 'Design tools',
    // Four download cards and three pointer cards need more than a heading list
    // and less than a console, and a third would leave the Figma frame half the
    // window at 1280.
    panelWidth: '24%',
    contextBar: true,
    statusBar: false,
    canGoFull: true,
    fullWhenNarrow: false,
  },

  component: {
    kind: 'component',
    sections: ['rendering', 'device', 'props', 'source'],
    panelTitle: 'Component',
    panelWidth: '31%',
    contextBar: true,
    statusBar: true,
    canGoFull: true,
    fullWhenNarrow: false,
  },

  preview: {
    kind: 'preview',
    sections: ['appearance', 'state', 'console', 'tokens', 'measure', 'inspect'],
    panelTitle: 'Tools',
    panelWidth: '31%',
    contextBar: true,
    statusBar: true,
    canGoFull: true,
    fullWhenNarrow: true,
  },
};

/**
 * What a section is called, wherever it is drawn.
 *
 * Here rather than passed by the page, because the id is in the URL under
 * `tool=`: a page that could rename its own section would be renaming something
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
  '/preview': 'preview',
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
 * `/components/ui/NotAThing` used to open a rail with `Rendering`, `Device`,
 * `Props` and `Source` on it and nothing behind any of them, plus a blank status
 * line — four icons that answer nothing, which is what a declaration costs when
 * nothing can fill it. `test/shell.test.ts` reads the page files as text and
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
