import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';

import api from 'virtual:api';
import docsModule from 'virtual:docs';
import { DIAGRAMS } from './diagrams';
import { ComponentDetail } from './pages/ComponentDetail';
import { Components } from './pages/Components';
import { Design } from './pages/Design';
import { DiagramIndex } from './pages/DiagramIndex';
import { DiagramView } from './pages/DiagramView';
import { Handbook } from './pages/Handbook';
import { Document } from './pages/Document';
import { Landing } from './pages/Landing';
import { Reference } from './pages/Reference';
import { Decisions } from './pages/Decisions';
import { Sources } from './pages/Sources';
import { Preview } from './pages/Preview';
import { ActivityBar } from './ui/ActivityBar';
import { Boundary } from './ui/Boundary';
import { ContextPanel, NarrowSections } from './ui/ContextPanel';
import { Header } from './ui/Header';
import { Search } from './ui/Search';
import { Settings } from './ui/Settings';
import { ShowChrome } from './ui/ShowChrome';
import { StatusBar } from './ui/StatusBar';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useDragging,
  usePanelState,
  type PanelHandle,
} from './ui/kit/resizable';
import { Sheet, SheetContent, SheetTitle } from './ui/kit/sheet';
import { TooltipProvider } from './ui/kit/tooltip';
import { SlotProvider, SlotTarget, slotsOf } from './shell/slots';
import { toggled, useAddress, type ShellProps } from './shell/address';
import { resolveView } from './shell/views';
import { cn } from './lib/cn';
import { useMedia, WIDE } from './lib/useMedia';
import { PAGE_TITLES } from './nav';
import { useAppearance } from './theme';
import { href, useLinkInterception, useRoute } from './router';

/**
 * Every `group/name` the app has, built once, for `resolveView`.
 *
 * One `Set` rather than a search through the groups on every render, and at
 * module scope because the reference is generated at build time and cannot move
 * while the page is open.
 */
const COMPONENT_IDS = new Set(
  api.components.groups.flatMap((group) => group.components.map((c) => `${group.name}/${c.name}`)),
);

const hasComponent = (group: string, name: string) => COMPONENT_IDS.has(`${group}/${name}`);

/**
 * One application, not a site with a tool bolted to the side of it.
 *
 * Everything is a view of the same shell: a record, the sources board, the
 * drawings, the core's reference, one of the app's components drawn, and the app
 * itself in its frame. The rail on the far left reaches any of them from any of
 * them, and the right sidebar holds whatever the open view has to say about
 * itself.
 *
 * **The route declares and the page fills.** `shell/views.ts` says which sections
 * a view offers, whether it has a context bar, whether it owns the status line
 * and whether `full=1` means anything on it; the page puts its content into
 * those places through `shell/slots.tsx`. This file therefore branches on width
 * and on nothing else — the seven `isApp` branches it used to carry are what made
 * the preview a second site, and `ADR 0028` records why they are gone.
 *
 * The panel's own state — open, and which sections are open — is in the hash on
 * every route (`shell/address.ts`), which is what the preview alone used to do.
 */
export function App() {
  const [route] = useRoute();
  const [appearance, setAppearance] = useAppearance();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const doc = docsModule.docs.find((d) => d.route === route);
  const { view, params } = resolveView(route, doc !== undefined, hasComponent);
  const [address, setAddress] = useAddress(view);
  useLinkInterception();

  /*
   * Two layouts, not one layout with different numbers. Wide, the sidebar is a
   * panel in a resizable group and the page has what is left. Narrow, there is no
   * room to divide: a `drawer` view puts its sections in a sheet over the page,
   * and a `page` view puts them after it.
   */
  const wide = useMedia(WIDE);
  const full = view.canGoFull && address.full;
  const narrowAsPage = !wide && view.narrow === 'page';
  const hasPanel = view.sections.length > 0;
  const panelOpen = hasPanel && address.tools && !narrowAsPage;

  const shell: ShellProps = { address, onAddress: setAddress, wide, full };
  const toggleSection = (id: Parameters<typeof toggled>[1]) =>
    setAddress({ open: toggled(address.open, id) });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (meta && key === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (meta && key === 'j' && hasPanel && !narrowAsPage) {
        event.preventDefault();
        setAddress({ tools: !address.tools });
      }
      // The way out of a view whose only control is one floating button. The
      // palette owns Escape while it is open, and it is a dialog, so it gets it.
      if (event.key === 'Escape' && full && !searchOpen) {
        event.preventDefault();
        setAddress({ full: false });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [address.tools, full, hasPanel, narrowAsPage, searchOpen, setAddress]);

  useEffect(() => {
    document.title = route === '/' ? 'CORRECTIV app workbench' : `${titleOf()} — Workbench`;

    function titleOf(): string {
      if (view.kind === 'component') return `${params.name}, a component`;
      return PAGE_TITLES[route] ?? doc?.title ?? 'Not found';
    }
  }, [doc, params.name, route, view.kind]);

  /*
   * The heading the hash names, scrolled to by this site rather than by the
   * browser.
   *
   * `#the-four-ports?tools=1` is not an anchor: the fragment is no longer an
   * element id, so the browser does nothing with it. `router.tsx` already scrolls
   * for a click on an in-site link, because the target does not exist until the
   * route has rendered; this is the other half, for a load and for a step through
   * history. Keyed on route and head together, so toggling a panel — which
   * rewrites the hash — does not throw the reader back up the page.
   */
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    const key = `${route}#${address.head}`;
    if (scrolledTo.current === key) return;
    scrolledTo.current = key;
    if (address.head === '' || address.head.startsWith('/')) return;
    const id = decodeURIComponent(address.head);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [address.head, route]);

  /*
   * Docked, the sidebar collapses to nothing rather than being unmounted, so its
   * width has a value to animate from. `useDragging` turns the transition off
   * while a handle is held, or every frame of the drag chases a 200ms animation.
   *
   * Both the panel and its handle stay mounted for as long as this layout does,
   * whatever the open view puts in them. They used to come and go with the route,
   * and `react-resizable-panels` re-registers its children when the list changes:
   * an imperative `resize()` landing in that gap threw "Panel constraints not
   * found" and took the whole page with it.
   */
  const panelRef = useRef<PanelHandle>(null);
  const dragging = useDragging();
  /*
   * The width to come back to. `expand()` restores "its most recent size", and
   * for a panel that has only ever been collapsed that is the minimum: the
   * inspector opened at fourteen per cent, a third of what it asks for. So the
   * size is stated on the way in, and a width somebody dragged to is what gets
   * stated next time.
   */
  const dragged = useRef<string | null>(null);
  usePanelState(panelRef, panelOpen, () => dragged.current ?? view.panelWidth, wide && !full);

  const page = pageFor();

  function pageFor(): ReactNode {
    switch (view.kind) {
      case 'landing':
        return <Landing />;
      case 'handbook':
        return <Handbook />;
      case 'diagrams':
        return <DiagramIndex />;
      case 'reference':
        return <Reference />;
      case 'sources':
        return <Sources />;
      case 'decisions':
        return <Decisions />;
      case 'design':
        return <Design {...shell} />;
      case 'components':
        return <Components />;
      case 'component':
        return <ComponentDetail group={params.group} name={params.name} {...shell} />;
      case 'preview':
        return <Preview {...shell} />;
      case 'diagram': {
        const meta = DIAGRAMS.find((d) => d.id === params.id);
        return meta ? <DiagramView meta={meta} /> : <NotFound route={route} />;
      }
      case 'document':
        return doc ? <Document doc={doc} /> : <NotFound route={route} />;
      default:
        return <NotFound route={route} />;
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SlotProvider declared={slotsOf(view)}>
        <div className="flex h-dvh flex-col bg-canvas text-on-canvas">
          <a
            href="#content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-s focus:top-s focus:z-50 focus:rounded-md focus:bg-accent focus:px-s focus:py-xs focus:text-white"
          >
            Skip to content
          </a>

          {!full && (
            <Header
              onSearch={() => setSearchOpen(true)}
              onSettings={() => setSettingsOpen(true)}
              toolsOpen={address.tools}
              onToggleTools={
                hasPanel && !narrowAsPage ? () => setAddress({ tools: !address.tools }) : undefined
              }
              toolsLabel={view.panelTitle ?? undefined}
              onFull={view.canGoFull ? () => setAddress({ full: true }) : undefined}
            >
              {/* The context bar. Narrow and in a drawer it moves inside the
                  drawer, which is where the preview's controls have always
                  gone at 390px; narrow as a page it stays here and wraps. */}
              {view.contextBar && (wide || narrowAsPage) && <SlotTarget id="context-bar" />}
            </Header>
          )}

          <div className="relative flex min-h-0 flex-1">
            {!full && <ActivityBar route={route} />}

            <ResizablePanelGroup className={cn('min-w-0 flex-1', !dragging && 'panels-animate')}>
              {/*
                Keyed, both of them, because the right-hand one comes and goes.
                Without keys React matches these children by position, so a panel
                appearing changed places with a fragment and React answered by
                throwing the panel away and building a new one. That took the
                iframe with it, and the app came back blank.
              */}
              <ResizablePanel key="main" minSize="30%">
                {/*
                  The one scroller. Every view is a block inside it, which is why
                  none of them carries a `main` or a height of its own.
                */}
                <main id="content" className="h-full min-h-0 overflow-auto">
                  <Boundary route={route}>
                    {page}
                    {narrowAsPage && !full && (
                      <NarrowSections
                        view={view}
                        open={address.open}
                        onToggleSection={toggleSection}
                      />
                    )}
                  </Boundary>
                </main>
              </ResizablePanel>

              {wide && !full && (
                <Fragment key="tools">
                  <ResizableHandle className={cn(!panelOpen && 'hidden')} />
                  <ResizablePanel
                    panelRef={panelRef}
                    collapsible
                    collapsedSize="0%"
                    defaultSize={view.panelWidth}
                    minSize="14%"
                    maxSize="55%"
                    /* Only while a handle is held. Otherwise this fires on the layout
                       the collapse itself causes and writes the old state straight
                       back, which is a toggle that does nothing. */
                    onResize={(size) => {
                      if (!dragging) return;
                      if (size.asPercentage > 0) dragged.current = `${size.asPercentage}%`;
                      setAddress({ tools: size.asPercentage > 0 });
                    }}
                  >
                    <div className="h-full w-full overflow-hidden [contain:paint]">
                      <div className="h-full w-full min-w-[15rem]" inert={!panelOpen}>
                        <ContextPanel
                          view={view}
                          open={address.open}
                          onToggleSection={toggleSection}
                          onClose={() => setAddress({ tools: false })}
                        />
                      </div>
                    </div>
                  </ResizablePanel>
                </Fragment>
              )}
            </ResizablePanelGroup>

            {/*
              Narrow, a `drawer` view's sections are a drawer over the page rather
              than a column beside it. There is no width to divide at 390px: a
              fourteen per cent panel is fifty-five pixels, and the page it left
              behind is not a page.

              A `Sheet`, which is a Radix dialog, rather than a positioned div: it
              traps focus, closes on Escape and on a tap outside, hides the page
              behind it from a screen reader, and slides in from the edge it is
              docked to.
            */}
            {!wide && !full && !narrowAsPage && hasPanel && (
              <Sheet open={address.tools} onOpenChange={(open) => setAddress({ tools: open })}>
                <SheetContent side="right" className="w-[min(26rem,92vw)]">
                  {view.contextBar && (
                    <SlotTarget
                      id="context-bar"
                      className="shrink-0 border-b border-stroke p-xs empty:hidden"
                    />
                  )}
                  <div className="min-h-0 flex-1">
                    <ContextPanel
                      view={view}
                      open={address.open}
                      onToggleSection={toggleSection}
                      onClose={() => setAddress({ tools: false })}
                      titleAs={SheetTitle}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

          {!full && (
            <StatusBar>
              {view.statusBar ? (
                // Clipped, not wrapped. The line is one row tall by definition,
                // and a readout that ran past the end used to widen the page
                // itself: 120px of sideways scroll on a 1440px window.
                <SlotTarget id="status" className="flex min-w-0 flex-1 items-center gap-s" />
              ) : (
                <FileOrTitle route={route} file={doc?.file} design={view.kind === 'design'} />
              )}
            </StatusBar>
          )}
        </div>

        {full && <ShowChrome onShow={() => setAddress({ full: false })} />}

        <Search open={searchOpen} onClose={() => setSearchOpen(false)} />

        <Settings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          appearance={appearance}
          onAppearance={setAppearance}
        />
      </SlotProvider>
    </TooltipProvider>
  );
}

/**
 * Where you are, for a view that has nothing more particular to say.
 *
 * The path of the file being rendered, in the typeface a path is written in. A
 * page that is not a document has no file, so it says what it is instead — and
 * `/design` adds the commit, because "which commit is this built from" is a fact
 * about the current view and this line is where those go on every other view.
 */
function FileOrTitle({ route, file, design }: { route: string; file?: string; design: boolean }) {
  return (
    <span className={cn('truncate', file && 'font-mono')}>
      {file ?? PAGE_TITLES[route] ?? route}
      {design && ` · built from ${docsModule.commit.slice(0, 7)}`}
    </span>
  );
}

function NotFound({ route }: { route: string }) {
  return (
    <div className="mx-auto max-w-content px-m py-2xl">
      <h1 className="text-headline-l font-semibold">No page at {route}</h1>
      <p className="mt-s text-on-canvas-muted">
        The workbench publishes the repository&apos;s own documents. This address matches none of
        them. Press <kbd className="font-mono">⌘K</kbd> to search.
      </p>
      {/* The one family that lands here by being renamed rather than by being
          typed wrong, so it gets the way back that a bare 404 cannot give. */}
      {route.startsWith('/components/') && (
        <p className="mt-s text-on-canvas-muted">
          The app has no such component.{' '}
          <a
            className="text-on-canvas underline decoration-accent underline-offset-2"
            href={href('/components')}
          >
            Every component it does have
          </a>{' '}
          is one page back.
        </p>
      )}
    </div>
  );
}
