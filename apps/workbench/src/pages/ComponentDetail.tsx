import { ExternalLink, Maximize2, RotateCw } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

import api from 'virtual:api';
import type { ApiComponent } from 'virtual:api';
import { directEntry } from '../components/direct';
import { NOT_DRAWN } from '../components/direct-ids';
import { DirectPreview } from '../components/DirectPreview';
import { cn } from '../lib/cn';
import { href } from '../router';
import { Slot } from '../shell/slots';
import type { ShellProps } from '../shell/address';
import { Badge } from '../ui/kit/badge';
import { Button } from '../ui/kit/button';
import { Segmented } from '../ui/kit/segmented';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/kit/tooltip';
import { Source } from '../ui/Lookup';
import { AppFrame } from '../preview/AppFrame';
import { DEFAULT_DEVICE, DEVICES, preset } from '../preview/devices';
import { FRAME_ROOM, fitScale } from '../preview/scale';

const { groups } = api.components;

const CARD = 'rounded-md border border-stroke bg-canvas p-xs';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const FIELD =
  'h-[1.75rem] rounded-md border border-stroke bg-canvas px-2xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** The two renderings, and the parameter that chooses between them. */
type Rendering = 'direct' | 'bundle';

/**
 * One component, drawn twice over, with its props beside it.
 *
 * `/components` is the grid and this is where a component gets room. The
 * relation between a drawing and a frame inverts here, which is the whole reason
 * this route exists: a drawn component takes the space its content needs, and a
 * frame always carries a viewport, so on a card of about three hundred pixels a
 * frame would be a shrunken phone with the component somewhere on it. Here the
 * frame has room, the device size becomes a real choice again, and
 * `preview/devices.ts` already holds the presets for it (ADR 0028).
 *
 * **The two renderings are both offered and never compared.** "This site" is the
 * workbench's own React tree over `react-native-web`; "the app's bundle" is the
 * shipped app in a frame, and where they disagree the app is right (ADR 0027).
 * Nothing checks one against the other and nothing should: screenshot diffing is
 * the flakiest thing in CI, and a check that reddens without cause gets switched
 * off. A disagreement is a finding for a person.
 */
export function ComponentDetail({
  group,
  name,
  address,
  onAddress,
  wide,
  full,
}: ShellProps & { group: string; name: string }) {
  const id = `${group}/${name}`;
  /*
   * Both halves of a platform split, because `?c=` carries no platform: the
   * gallery draws whichever the bundler kept and cannot say which, so a route
   * that named one would be answering a question this page cannot ask.
   */
  const rows =
    groups.find((g) => g.name === group)?.components.filter((c) => c.name === name) ?? [];
  const entry = directEntry(id);

  const device = readDevice(address.rest.get('d'));
  const rendering: Rendering =
    entry === undefined ? 'bundle' : readRendering(address.rest.get('r'));

  const setRest = (patch: Record<string, string | null>) => {
    const rest = new URLSearchParams(address.rest);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) rest.delete(key);
      else rest.set(key, value);
    }
    onAddress({ rest });
  };

  const [reloads, setReloads] = useState(0);
  const { stage, box } = useBox();
  const size = preset(device);
  const scale = fitScale(box, size, FRAME_ROOM);

  /*
   * There is always a row here: `resolveView` only answers with this view for a
   * `group/name` the reference has, so an address that names nothing is the
   * not-found view and never reaches this file. That check is there rather than
   * here because the panel is declared before the page renders — returning early
   * from this component left the route's four sections on screen with nothing in
   * any of them.
   */
  const first = rows[0];
  /** Narrow and not full: no room for a device frame, so it gets a door. */
  const asPage = !wide && !full;

  return (
    <>
      {/*
        `h-full` only where this view owns the height. Narrow it does not: the
        sections are rendered after the page, so the column scrolls as one and a
        stage that filled the viewport and scrolled inside itself would be a
        second scroller in it — the specimens caught in a 688px box that a reader
        has to get past before the props are reachable. Measured at 390px on
        2026-09-11, `ui/Typo`: the page scrolled 2,669px and the stage inside it
        3,584px. `pages/Design.tsx` makes the same split for the same reason.
      */}
      <div
        className={cn(
          'stage-grid flex flex-col bg-canvas',
          full ? 'h-dvh' : asPage ? 'min-h-[60dvh]' : 'h-full',
        )}
      >
        {!full && (
          <nav aria-label="Breadcrumb" className="shrink-0 px-m py-s text-s text-on-canvas-muted">
            <ol className="flex flex-wrap items-center gap-2xs">
              <li>
                <a className="hover:text-on-canvas" href={href('/components')}>
                  Components
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <a className="hover:text-on-canvas" href={`${href('/components')}#g-${group}`}>
                  {group}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-mono text-on-canvas">{name}</li>
              {rows.map(
                (row) =>
                  row.platform && (
                    <li key={row.platform}>
                      <Badge variant="outline" className="font-mono">
                        {row.platform}
                      </Badge>
                    </li>
                  ),
              )}
            </ol>
          </nav>
        )}

        {rendering === 'direct' && entry !== undefined ? (
          /*
            Every specimen twice, on `canvas` and on `surface`, which is the app's
            own gallery layout reproduced with this site's classes. A component
            that reaches for a primitive where it meant a semantic token looks
            right on exactly one of the two, and right on both in light mode.
          */
          <div className={cn('min-h-0 flex-1 p-m', !asPage && 'overflow-auto')}>
            <div className="mx-auto" style={{ maxWidth: size.w === 0 ? undefined : size.w }}>
              {entry.specimens.map((specimen) => (
                <section key={specimen.label} className="mb-m last:mb-0">
                  <h2 className="mb-2xs font-mono text-s text-on-canvas-muted">{specimen.label}</h2>
                  <div className="overflow-hidden rounded-md border border-stroke">
                    <p className={cn(NOTE, 'border-b border-stroke px-s py-3xs')}>canvas</p>
                    <DirectPreview specimens={[specimen]} ground="canvas" labels={false} />
                    {!specimen.ownSurface && (
                      <>
                        <p className={cn(NOTE, 'border-y border-stroke px-s py-3xs')}>surface</p>
                        <DirectPreview specimens={[specimen]} ground="surface" labels={false} />
                      </>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : asPage ? (
          <div className="flex min-h-[40dvh] flex-1 flex-col items-center justify-center px-m py-xl text-center">
            <p className={cn(NOTE, 'max-w-content')}>
              The app&apos;s bundle draws this in a device frame, which needs more width than there
              is here.
            </p>
            <Button size="lg" className="mt-s" onClick={() => onAddress({ full: true })}>
              <Maximize2 aria-hidden="true" />
              Open full screen
            </Button>
          </div>
        ) : (
          <div ref={stage} className="relative flex min-h-0 flex-1 overflow-auto p-m">
            <div className="m-auto">
              <AppFrame
                key={`${id}-${device}-${reloads}`}
                route={`/gallery?c=${id}&bare=1`}
                title={`${name}, drawn in the app`}
                size={size.w === 0 ? { w: box.w || 393, h: box.h || 640 } : size}
                scale={size.w === 0 ? 1 : scale}
              />
            </div>
          </div>
        )}
      </div>

      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2xs">
          {/*
            The gallery, and not this component in it, because the preview
            cannot carry a query on the app's route: `shell/address.ts` splits the
            hash at the first `?`, so everything after it is a parameter, and
            `preview/state.ts` writes back only the ten it knows. A
            `#/gallery?c=ui/Card` therefore arrives as `#/gallery` and the frame
            opens the whole gallery. Measured on 2026-09-11 — the link said the
            component's name and the frame's address was `/app/gallery`, with
            nothing anywhere to say so. The label is what the link does.
          */}
          <Button variant="outline" size="sm" asChild>
            <a href={`${href('/preview')}#/gallery?d=${device}`}>
              <ExternalLink aria-hidden="true" />
              The gallery in the preview
            </a>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reload the frame"
                disabled={rendering !== 'bundle'}
                onClick={() => setReloads((n) => n + 1)}
              >
                <RotateCw aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reload the frame</TooltipContent>
          </Tooltip>
        </div>
      </Slot>

      <Slot id="rendering">
        <Segmented
          name="rendering"
          legend="Drawn by"
          value={rendering}
          options={[
            { value: 'direct', label: 'This site' },
            { value: 'bundle', label: "The app's bundle" },
          ]}
          onChange={(value) => setRest({ r: value === 'direct' ? null : value })}
          disabled={entry === undefined}
        />
        {entry === undefined ? (
          <p className={NOTE}>
            Not drawn here: {NOT_DRAWN[id] ?? 'the app’s catalogue has no specimen for it.'} The
            bundle draws it.
          </p>
        ) : (
          <p className={NOTE}>
            Two renderings of one component. A difference between them is a finding, not a blemish;
            nothing checks them against each other, on purpose.
          </p>
        )}
        {rendering === 'bundle' && (
          <p className={NOTE}>
            The frame holds{' '}
            <b className="font-semibold text-on-canvas">
              {import.meta.env.DEV ? 'the dev server through the proxy' : 'the published export'}
            </b>
            .
          </p>
        )}
      </Slot>
      <Slot id="rendering:tags">
        <Badge variant="outline">{rendering === 'direct' ? 'this site' : "app's bundle"}</Badge>
      </Slot>

      <Slot id="device">
        <label className="flex flex-col gap-2xs">
          <span className={NOTE}>Device</span>
          <select
            className={cn(FIELD, 'w-full')}
            value={device}
            onChange={(event) =>
              setRest({ d: event.target.value === DEFAULT_DEVICE ? null : event.target.value })
            }
          >
            {DEVICES.filter((d) => d.id !== 'custom').map((d) => (
              <option key={d.id} value={d.id}>
                {d.w === 0 ? d.label : `${d.label}, ${d.w}×${d.h}`}
              </option>
            ))}
          </select>
        </label>
        <p className={cn(NOTE, 'tabular-nums')}>
          {size.w === 0
            ? 'The box this page gives it, whatever that is.'
            : rendering === 'bundle'
              ? `${size.w} × ${size.h} at ${Math.round(scale * 100)}%`
              : `Column capped at ${size.w} px. The height is the component's own.`}
        </p>
      </Slot>
      <Slot id="device:tags">
        <Badge variant="outline" className="font-mono tabular-nums">
          {size.w === 0 ? 'host' : `${size.w}×${size.h}`}
        </Badge>
      </Slot>

      <Slot id="props">
        {rows.map((row) => (
          <Props key={row.platform ?? 'shared'} row={row} split={rows.length > 1} />
        ))}
      </Slot>
      <Slot id="props:tags">
        <Badge variant="outline" className="tabular-nums">
          {first.props.length === 1 ? '1 prop' : `${first.props.length} props`}
        </Badge>
      </Slot>

      <Slot id="source">
        <p className="break-words font-mono text-s text-on-canvas-muted">
          {`import { ${first.name} } from '${first.import}'`}
        </p>
        {first.doc && (
          <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: first.doc }} />
        )}
        {rows.map((row) => (
          <Source key={row.platform ?? 'shared'} file={row.file} line={row.line} />
        ))}
      </Slot>

      <Slot id="status">
        <span className="truncate font-mono">{rows.map((row) => row.file).join(' · ')}</span>
      </Slot>
    </>
  );
}

/** One platform's props, as the grid the overview used to carry in its rows. */
function Props({ row, split }: { row: ApiComponent; split: boolean }) {
  return (
    <div>
      {split && (
        <h4 className="mb-2xs font-mono text-s font-semibold text-on-canvas">
          {row.platform === 'web' ? '.web.tsx' : '.tsx'}
        </h4>
      )}
      {row.propsType && <p className="font-mono text-s text-on-canvas-muted">{row.propsType}</p>}
      {row.propsDoc && (
        <div className="prose prose-sm mt-2xs" dangerouslySetInnerHTML={{ __html: row.propsDoc }} />
      )}
      {row.props.length === 0 ? (
        <p className="mt-2xs text-m text-on-canvas-muted">None.</p>
      ) : (
        <dl className="mt-2xs divide-y divide-stroke border-y border-stroke">
          {row.props.map((prop) => (
            <div key={prop.name} className="py-xs">
              <dt className="min-w-0">
                <code className={cn(CARD, 'px-3xs py-4xs font-mono text-s wrap-anywhere')}>
                  {prop.name}
                  {prop.optional && '?'}
                </code>
                <p className="mt-3xs font-mono text-s text-on-canvas-muted wrap-anywhere">
                  {prop.type}
                  {prop.optional && ' · optional'}
                </p>
              </dt>
              <dd className="mt-2xs min-w-0 text-m text-on-canvas-muted">
                {prop.doc ? (
                  <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: prop.doc }} />
                ) : (
                  <span className="text-s italic">No prose.</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {row.inherits.length > 0 && (
        <p className="mt-s text-s text-on-canvas-muted">
          Plus everything in{' '}
          {row.inherits.map((type, index) => (
            <span key={type}>
              {index > 0 && ', '}
              <code className="font-mono wrap-anywhere">{type}</code>
            </span>
          ))}
          , which this repository does not own and which is named here rather than expanded.
        </p>
      )}
    </div>
  );
}

/** A device the presets know, or the default. `custom` has no handles here. */
function readDevice(asked: string | null): string {
  if (asked === null || asked === 'custom') return DEFAULT_DEVICE;
  return DEVICES.some((d) => d.id === asked) ? asked : DEFAULT_DEVICE;
}

/**
 * `r=direct` for a component this site cannot draw falls back rather than
 * refusing: nothing offers that address, so only a hand-typed one arrives here,
 * and the frame is a fair answer to it.
 */
function readRendering(asked: string | null): Rendering {
  return asked === 'bundle' ? 'bundle' : 'direct';
}

/** The stage's own box, measured, which is what the frame is scaled against. */
function useBox() {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => {
      const next = { w: element.clientWidth, h: element.clientHeight };
      setBox((previous) => (previous.w === next.w && previous.h === next.h ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
    // No dependency list: the element this holds is replaced whenever the
    // rendering switches, and an observer left on the old one measures a box
    // nobody can see. Re-attaching every render is one `observe` call.
  });

  return { stage, box };
}
