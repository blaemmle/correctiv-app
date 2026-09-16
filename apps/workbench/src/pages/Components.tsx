import { useEffect, useMemo, useState } from 'react';

import api from 'virtual:api';
import type { ApiComponent, ApiComponentGroup } from 'virtual:api';
import { useClipped } from '../components/clipped';
import { directEntry, DRAWN_IDS } from '../components/direct';
import { NOT_DRAWN } from '../components/direct-ids';
import { DirectPreview } from '../components/DirectPreview';
import { href, navigate } from '../router';
import { Slot } from '../shell/slots';
import { Badge } from '../ui/kit/badge';
import { Segmented } from '../ui/kit/segmented';
import { Filter, Source } from '../ui/Lookup';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';

const { alias, groups, root } = api.components;

/** The card's box, which is `ui/CardGrid.tsx`'s without its single-link shape. */
const CARD =
  'flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-stroke bg-surface transition-colors hover:border-stroke-strong';

/**
 * `?c=ui/SectionCard` is the gallery's way back, and it lands on the component.
 *
 * The app's gallery addresses a component the same way — `folder/name`, which is
 * `gallery/catalogue.tsx`'s `componentId` — so one agreement carries a link in
 * both directions and neither side has to know the other's URLs. What changed is
 * where it lands: there is a page per component now, so the query is translated
 * into that address rather than into an anchor on this one.
 *
 * Replaced rather than pushed, so the back button leaves instead of bouncing off
 * the redirect. A name that matches nothing stays here, which is a fair answer to
 * a hand-typed address.
 */
function useAskedFor(): void {
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get('c');
    if (!asked) return;
    const [group, name] = asked.split('/');
    const known = groups.find((g) => g.name === group)?.components.some((c) => c.name === name);
    if (known) navigate(`/components/${group}/${name}`, { replace: true });
  }, []);
}

/**
 * The app's components, as a grid of cards that draw themselves when asked.
 *
 * `/reference` is a library: `packages/app-core` behind subpath imports, the same
 * for every host it ever gets. This is the app's own vocabulary, and the question
 * a reader arrives with is a different one: not "which subpath" but "what does
 * this look like".
 *
 * **No frames on this page at all.** Every row used to open onto an iframe
 * booting the whole app at phone width, three at a time, and a frame always
 * carries a viewport: what that gave for `Hairline`, a one-pixel line, was a
 * 393px phone with a line somewhere on it. A card draws the component itself, in
 * this site's own React tree, at the size the component is (ADR 0027), and the
 * frame moved to `/components/<group>/<name>` where it has room to be a device
 * again (ADR 0028). The three-frame cap and the "load all" control went with it.
 *
 * **And nothing is asked for.** Every card draws on arrival. There was a Draw
 * button on each of them for one commit, inherited from the era when a preview
 * meant booting the app in a frame; `direct.tsx` imports the components
 * statically, so the bytes are paid whether or not anybody presses anything.
 * Measured on 2026-09-11: mounting all 47 adds about 100 ms to the first render,
 * 460 ms on a CPU throttled four times, and the page still scrolls end to end at
 * 60 frames a second with nothing over 17 ms. ADR 0028 carries the table.
 *
 * **And a card that cannot show all of a component says so.** The square each
 * one reserves is the column the grid gives it, which at a desktop width is
 * between 19rem and 24rem, and against the 47 specimens that leaves a handful
 * taller than the box they are drawn in. Those get a fade and a line saying how
 * tall the component really is, measured in the browser rather than listed here,
 * because the set changes with the grid, the window and the app.
 */
export function Components() {
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<'all' | 'drawn'>('all');
  useAskedFor();

  const sections = useSections('/components', true);

  /*
   * A prop's name is part of what a component matches on. "onPress" is a real
   * question somebody arrives with, 14 of the 45 components take one, and
   * against the names and the summaries alone it matches nothing at all.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches: ApiComponentGroup[] = [];
    for (const group of groups) {
      const wholeFolder = q !== '' && group.name.toLowerCase().includes(q);
      const components = group.components.filter((component) => {
        if (only === 'drawn' && !DRAWN_IDS.has(`${group.name}/${component.name}`)) return false;
        if (q === '' || wholeFolder) return true;
        return `${component.name} ${component.summary} ${component.props
          .map((p) => p.name)
          .join(' ')}`
          .toLowerCase()
          .includes(q);
      });
      const helpers =
        only === 'drawn'
          ? []
          : group.helpers.filter(
              (helper) =>
                q === '' ||
                wholeFolder ||
                `${helper.name} ${helper.summary}`.toLowerCase().includes(q),
            );
      if (components.length > 0 || helpers.length > 0) {
        matches.push({ ...group, components, helpers });
      }
    }
    return matches;
  }, [only, query]);

  const count = filtered.reduce((n, group) => n + group.components.length, 0);
  const drawnCount = filtered.reduce(
    (n, group) =>
      n + group.components.filter((c) => DRAWN_IDS.has(`${group.name}/${c.name}`)).length,
    0,
  );

  return (
    <>
      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-xs">
          <Filter
            id="comp-q"
            label="Filter folders, components and props"
            placeholder="Filter, for example Typo, onPress or reader"
            value={query}
            onChange={setQuery}
            summary={`${filtered.length} folders, ${count} components, ${drawnCount} drawn here`}
          />
          <Segmented
            name="drawn"
            legend="Which components"
            className="shrink-0"
            value={only}
            options={[
              { value: 'all', label: 'All' },
              { value: 'drawn', label: 'Drawn here' },
            ]}
            onChange={(value) => setOnly(value === 'drawn' ? 'drawn' : 'all')}
          />
        </div>
      </Slot>

      <Slot id="contents">
        <Toc headings={sections} />
      </Slot>

      <Page>
        <article className="min-w-0">
          <h1 className="text-headline-xl font-bold leading-tight tracking-tight">Components</h1>
          <p className="mt-xs max-w-content text-m leading-relaxed text-on-canvas-muted">
            Every component the app builds its screens from, taken out of{' '}
            <code className="font-mono">{root}</code> with its props, their types and whatever prose
            the source carries. Every card draws its component, from the app&apos;s source, in this
            site&apos;s own React tree, and a card too small to hold the whole of one says so at its
            lower edge; the component&apos;s own page has every specimen whole, the app&apos;s
            bundle beside it, and a device size. The core&apos;s exports are a separate section:{' '}
            <a
              href={href('/reference')}
              className="text-on-canvas underline decoration-accent underline-offset-2"
            >
              Reference
            </a>
            , which is a library and imported as one.
          </p>

          {filtered.length === 0 && (
            <p className="py-2xl text-center text-m text-on-canvas-muted">Nothing matches that.</p>
          )}

          {filtered.map((group) => (
            <section className="mt-xl" key={group.name}>
              <h2
                id={`g-${group.name}`}
                className="scroll-mt-[4.75rem] font-mono text-headline-m font-semibold leading-tight wrap-anywhere"
              >
                {group.name}
              </h2>
              <p className="mt-3xs break-words font-mono text-s text-on-canvas-muted">
                {group.barrel
                  ? `import … from '${group.barrel}'`
                  : `import … from '${alias}/${group.name}/…'`}
              </p>
              {group.barrel && (
                <p className="mt-3xs max-w-content text-s text-on-canvas-muted">
                  This folder has a barrel, so a caller names the folder and not the file.
                </p>
              )}

              {/*
                A BAND, NOT A BREAKPOINT, because the column is what sizes the
                square a card reserves (`ComponentCard` below).

                Breakpoints cannot say what this has to say, because the column
                here is not a function of the window: the right-hand panel takes a
                quarter of it whenever a reader opens it. `sm:grid-cols-2
                xl:grid-cols-3` therefore gave 260px columns at 640, 379px at
                1280, 432px at 1440 and 301px at 1280 with the panel open — four
                answers to one question, the widest nearly twice the narrowest.
                Measured on 2026-09-11 against the 47 specimens: a 340px column
                clips three of them, a 260px column clips nine.

                So the grid states the band instead, 19rem up, and the card states
                24rem down. The two halves are written where they are because they
                are different questions: how many columns fit is the grid's, and
                how wide a card may usefully be is the card's. Both in the track
                would also change the answer — `repeat()` counts an `auto-fill`
                with a definite maximum at that maximum, so `minmax(19rem,24rem)`
                fits two 24rem columns at 1280 where three 19rem ones fit, and
                loses a whole column to say the same thing.

                `auto-fill` and not the other one: a folder with a single
                component in it keeps the column width of the folder above rather
                than stretching its one card across the row.
              */}
              <ul className="mt-s grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-xs">
                {group.components.map((component) => {
                  const id = `${group.name}/${component.name}`;
                  return (
                    <li
                      key={`${component.name}-${component.platform ?? ''}`}
                      className="mx-auto w-full min-w-0 max-w-[24rem]"
                    >
                      <ComponentCard id={id} group={group.name} component={component} />
                    </li>
                  );
                })}
              </ul>

              {group.helpers.length > 0 && (
                <div className="mt-s">
                  {/* Not components, and not hidden either: these are exports of
                      the same files that a screen imports beside the component. */}
                  <h3 className="text-s font-semibold uppercase tracking-wider text-on-canvas-muted">
                    Also exported here
                  </h3>
                  <ul className="mt-2xs divide-y divide-stroke overflow-hidden rounded-md border border-stroke">
                    {group.helpers.map((helper) => (
                      <li key={helper.name} className="px-s py-2xs">
                        <p className="flex flex-wrap items-baseline gap-xs">
                          <span className="font-mono text-s text-on-canvas-muted">
                            {helper.kind}
                          </span>
                          <span className="font-mono text-m font-semibold">{helper.name}</span>
                          <span className="min-w-0 flex-1 text-s text-on-canvas-muted">
                            {helper.summary}
                          </span>
                        </p>
                        {helper.signature && (
                          <p className="mt-3xs whitespace-pre-wrap break-words font-mono text-s text-on-canvas-muted">
                            {helper.signature}
                          </p>
                        )}
                        <Source file={helper.file} line={helper.line} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </article>
      </Page>
    </>
  );
}

/**
 * One card, in either of its two states, both of them the same shape.
 *
 * The preview area is the same square whether it holds a drawing or a badge, and
 * the head, the summary and the foot are identical in both. That is what keeps
 * the minority state from reading as broken: with two components undrawable the
 * exceptions are a statement about where the drawing is, and with forty of them
 * undrawable it is the same statement forty times. Nothing is dashed, greyed out,
 * or shaped like a loading state.
 *
 * **The square is reserved and not measured**, and that is the part of the shape
 * that has to stay: 47 specimens settle at their own speeds, and a preview area
 * sized by its content would reflow the grid under a reader who was already
 * reading it. It is `aspect-ratio: 1` rather than a height in rem, so the
 * reserved box follows the column the grid gives it and there is no number here
 * to keep in step with the one in the grid above.
 */
function ComponentCard({
  id,
  group,
  component,
}: {
  id: string;
  group: string;
  component: ApiComponent;
}) {
  const entry = directEntry(id);
  const route = `/components/${group}/${component.name}`;
  const { stage, column, clipped, natural } = useClipped<HTMLDivElement, HTMLDivElement>();

  return (
    <div className={CARD}>
      {/* Graph paper under the square, so a specimen that paints its own surface
          reads as a thing standing on a stage rather than a box on a page. */}
      <div
        ref={stage}
        className="stage-grid relative flex aspect-square shrink-0 flex-col overflow-hidden border-b border-stroke bg-canvas"
      >
        {entry === undefined ? (
          <a
            href={href(route)}
            className="flex h-full flex-col items-center justify-center gap-2xs px-s text-center"
          >
            <Badge variant="outline">Drawn in the app&apos;s bundle</Badge>
            <span className="text-s text-on-canvas-muted">
              {NOT_DRAWN[id] ?? 'Its page draws it in the shipped app.'}
            </span>
          </a>
        ) : (
          <>
            {/*
              CENTRE THE STAGE, NEVER THE SPECIMEN.

              `my-auto` and not `justify-center`, and the difference is the whole
              rule. Auto margins take the free space when there is some, which
              centres a short component in the square — vertical position carries
              no meaning for something that lives in a scrolling column, and a
              row pinned to the top of a 340px square reads as adrift. When the
              specimen is taller than the square there is no free space, the
              margins resolve to zero, and the component is drawn from its top
              edge and cut off at the bottom. `justify-content: center` would
              instead split the overflow between the two edges and shave the top
              off every tall component, which is the half a reader most needs.

              `mx-auto w-full` is the horizontal half: the COLUMN is centred when
              it is narrower than the card, and the column is full width today, so
              nothing moves. What must never happen is the column shrinking to its
              content, because then `ui/Badge` and `participate/ClaimStatusTag`
              would appear centred when both say `self-start` in the app, and the
              card would misdescribe them. A full-width column is also what shows
              which components stretch and which hug.
            */}
            <div ref={column} className="mx-auto my-auto w-full">
              <DirectPreview
                specimens={entry.specimens.slice(0, 1)}
                ground="canvas"
                labels={false}
              />
            </div>
            {/*
              A CROP THAT SAYS IT IS ONE.

              Without this the card passes a crop off as the whole component,
              which is a quieter version of the lie ADR 0027 measured: a frame
              that drew a 393pt phone and called it `Hairline`. It is a fade and
              one line, painted over a region that is already cut, and it appears
              only on the cards that are cutting something — on every card that
              fits, nothing is drawn over the specimen at all.

              Not scaled to fit, which was the other candidate: `LoginGate` is a
              screen, and a screen shrunk into a card is an unreadable thumbnail
              claiming a size the component has never had. The whole component is
              on its own page, which is what the link below this covers the square
              with.

              Which components clip is measured and never listed: `clipped.ts`
              says why, and the set moves with the grid, the window and the app.
            */}
            {clipped && (
              <p
                aria-hidden="true"
                /* The fade reaches full canvas before the line starts, so the
                   note is read against the page's own ground and not against
                   whatever the component happens to be showing there. Above
                   that it is a fade and nothing else: the point is that the
                   component runs out of card, not that a band was painted. */
                className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end bg-linear-to-t from-canvas from-40% to-transparent px-s pb-2xs pt-ml text-s text-on-canvas-muted tabular-nums"
              >
                Clipped · {natural} px tall
              </p>
            )}
            {/*
              The way to the component's own page, over the drawing rather than on
              it.

              This was a pill reading "All specimens", parked in the bottom-right
              corner on its own opaque ground, and what it did there was cover the
              component: `ClubCard` lost the line under the member's name,
              `CalloutCard` its progress bar, `SpotlightBriefing` an entry. A
              control that hides the thing it is a control for is worse than no
              control, and the card already says where it goes twice over — the
              component's name below is a link, and the page's own prose says the
              component's page has every specimen.

              An anchor and not a wrapper: a specimen contains `<button>`s of its
              own and an `<a>` around one of those is invalid, so this sits over
              the drawing as a sibling instead. That also stops a press landing on
              a specimen's own control, which on a card does nothing anybody wants.

              It also carries the crop, because the marker above it is the one
              thing on the card a reader cannot act on and this link is the act:
              the note is `aria-hidden` and what it says is in the label here,
              attached to the thing that resolves it.
            */}
            <a
              href={href(route)}
              aria-label={
                clipped
                  ? `Every specimen of ${component.name}, which this card clips at ${natural} px`
                  : `Every specimen of ${component.name}`
              }
              className="absolute inset-0 rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-sm">
        <p className="flex min-w-0 flex-wrap items-center gap-2xs">
          <a
            href={href(route)}
            className="font-mono text-headline-xs font-semibold text-on-canvas underline decoration-accent underline-offset-2"
          >
            {component.name}
          </a>
          {component.platform && (
            /* The one thing about a component that changes what it is: this file
               is the half Metro keeps for that platform, and the twin beside it
               is the other. Written, not coloured. */
            <Badge variant="outline" className="font-mono">
              {component.platform}
            </Badge>
          )}
        </p>

        <p className="mt-3xs line-clamp-2 text-m leading-relaxed text-on-canvas-muted">
          {component.summary || <span className="italic">No doc comment.</span>}
        </p>

        <p className="mt-auto flex items-baseline gap-s pt-s font-mono text-s text-on-canvas-muted">
          <span className="min-w-0 flex-1 truncate" title={component.file}>
            {component.file}
          </span>
          <span className="shrink-0 tabular-nums">
            {component.props.length === 1 ? '1 prop' : `${component.props.length} props`}
          </span>
        </p>
      </div>
    </div>
  );
}
