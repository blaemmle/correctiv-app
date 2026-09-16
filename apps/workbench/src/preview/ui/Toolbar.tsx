import { Fragment, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, RotateCw } from 'lucide-react';

import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { Segmented } from '../../ui/kit/segmented';
import { Separator } from '../../ui/kit/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';
import { Pages } from './Pages';
import { DEVICES, HOST_DEVICE } from '../devices';
import { ROUTES } from '../routes';
import { frameSize, type PreviewState } from '../state';
import type { Status } from '../api';

/** The context bar's one field shape, so its selects and inputs agree. */
const FIELD =
  'h-[1.75rem] rounded-md border border-stroke bg-canvas px-2xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

interface Props {
  state: PreviewState;
  status: Status;
  routeField: string;
  onRouteField: (value: string) => void;
  onChange: (patch: Partial<PreviewState>) => void;
  onReload: () => void;
  onRaw: () => void;
}

const ZOOMS: { value: string; label: string }[] = [
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
  { value: 'fit', label: 'Fit' },
];

/**
 * What the app view puts in the header's context bar: device, size, zoom, route.
 *
 * These four are the demo's own controls, and `README.md` hands out the address
 * that carries them. Everything added since is in the right sidebar, which opens
 * shut on this view, because a debug surface is not what somebody following a
 * link to see the app came for.
 *
 * One row, no labels above the fields. The bar is 2.75rem tall on every view and
 * has to stay that way, so each control names itself through its own value or an
 * `aria-label`, and the tooltip carries the rest.
 *
 * `status` is still handed over because the contract with `Preview.tsx` says
 * so, and it is deliberately not read here: the warning and error counts belong
 * to the inspector, and a count of errors on the demo bar is the first crack in
 * the two-audience rule above.
 */
export function Toolbar({ state, routeField, onRouteField, onChange, onReload, onRaw }: Props) {
  const size = frameSize(state);
  /*
   * At the host's own size there is no frame to turn or to scale: the app has
   * the screen. Both controls are written out rather than disabled, because a
   * bar on a 390px screen wraps, and two rows of controls that cannot do
   * anything are two rows of the app nobody can see.
   */
  const host = state.device === HOST_DEVICE;
  /*
   * Read off the frame, never off `state.landscape`. That flag swaps the two
   * numbers, and it only reads as "landscape" while every pair is written
   * portrait-first. Two things are not: a custom size is whatever was typed into
   * the fields, and the presets above tablet size are written the way a laptop is
   * used. Measured on `d=desktop` before this line existed, the control had
   * "Portrait" lit beside a 1440 × 900 frame.
   */
  const landscape = size.w > size.h;

  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2xs"
      role="toolbar"
      aria-label="Frame"
    >
      <select
        className={cn(FIELD, 'shrink-0 max-w-[13rem]')}
        aria-label="Device"
        value={state.device}
        onChange={(e) =>
          onChange({
            device: e.target.value,
            landscape: false,
            // Carry the size over into `custom`, so picking it keeps what is on
            // screen. Not from `host`, whose `frameSize` is zero by design: the
            // stage measures that one, and spreading it collapsed the frame to
            // 0 × 0 with no way back but a reload.
            ...(e.target.value === 'custom' && !host ? size : {}),
          })
        }
      >
        {DEVICES.map((d) => (
          <option key={d.id} value={d.id}>
            {d.w === 0 ? d.label : `${d.label}, ${d.w}×${d.h}`}
          </option>
        ))}
      </select>

      {/*
        Only while the size is the person's own, as in the design. Every preset
        states its size in the option beside it, so two number fields that merely
        echo the select are noise on the bar the demo audience sees. Dragging the
        stage handles switches the device to `custom`, which is how the fields
        appear without anyone looking for them.
      */}
      {!host && state.device === 'custom' && (
        <span className="flex shrink-0 items-center gap-3xs">
          <input
            className={cn(FIELD, 'w-[4rem] text-center font-mono tabular-nums')}
            type="number"
            min={240}
            max={2400}
            aria-label="Width in CSS pixels"
            value={size.w}
            onChange={(e) =>
              onChange({
                device: 'custom',
                landscape: false,
                w: Math.max(240, Number(e.target.value) || size.w),
                h: size.h,
              })
            }
          />
          <span aria-hidden="true" className="text-on-canvas-muted">
            ×
          </span>
          <input
            className={cn(FIELD, 'w-[4rem] text-center font-mono tabular-nums')}
            type="number"
            min={320}
            max={2400}
            aria-label="Height in CSS pixels"
            value={size.h}
            onChange={(e) =>
              onChange({
                device: 'custom',
                landscape: false,
                w: size.w,
                h: Math.max(320, Number(e.target.value) || size.h),
              })
            }
          />
        </span>
      )}

      {!host && (
        <Segmented
          name="orientation"
          legend="Orientation"
          className="shrink-0"
          value={landscape ? 'landscape' : 'portrait'}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
          // A radio group fires only when the value actually changes, so the one
          // thing ever being asked for here is the other way round.
          onChange={() => onChange({ landscape: !state.landscape })}
        />
      )}

      {!host && (
        <select
          className={cn(FIELD, 'shrink-0')}
          aria-label="Zoom"
          value={String(state.zoom)}
          onChange={(e) =>
            onChange({ zoom: e.target.value === 'fit' ? 'fit' : Number(e.target.value) })
          }
        >
          {ZOOMS.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
      )}

      <Pages onPick={(route) => onChange({ route })} />

      <input
        className={cn(FIELD, 'min-w-[8rem] flex-1 font-mono')}
        type="text"
        list="routes"
        aria-label="Route"
        spellCheck={false}
        autoComplete="off"
        value={routeField}
        onChange={(e) => onRouteField(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onChange({ route: routeField });
        }}
        onBlur={() => onChange({ route: routeField })}
      />
      <datalist id="routes">
        {ROUTES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </datalist>

      <Separator orientation="vertical" className="h-[1.5rem]" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Reload the frame" onClick={onReload}>
            <RotateCw aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Reload the frame</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open the app on its own, without the frame"
            onClick={onRaw}
          >
            <ExternalLink aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open the app without the frame</TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * The address that reproduces exactly what is on screen.
 *
 * In the status line rather than in a row of its own. It is a fact about the
 * current view, which is what that line is for, and a second row under the header
 * would have pushed the frame down.
 *
 * The hash is handed over rather than derived here, and it is the shell's whole
 * hash: `shell/address.ts` has already written it with `replaceState`, and it
 * carries the panel's own `tools` and `open` beside the frame's parameters. So
 * this line shows the browser's address rather than a second rendering of half
 * the state that could drift from it. The values are picked out because the
 * point of it is that a knob moved and the link changed with it.
 */
export function LinkBar({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const cut = hash.indexOf('?');
  const route = hash.slice(1, cut === -1 ? undefined : cut);
  const params = cut === -1 ? [] : hash.slice(cut + 1).split('&');

  return (
    <span className="flex min-w-0 items-center gap-2xs">
      <code aria-live="off" className="truncate">
        {window.location.pathname}#<b className="text-on-canvas">{route}</b>
        {params.map((pair, index) => {
          const [key, value] = pair.split('=');
          return (
            <Fragment key={key}>
              {index === 0 ? '?' : '&'}
              {key}=<b className="text-on-canvas">{value}</b>
            </Fragment>
          );
        })}
      </code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-[1.375rem] shrink-0"
            aria-label="Copy this view as a link"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            }}
          >
            {copied ? (
              <Check aria-hidden="true" className="text-on-canvas-accent" />
            ) : (
              <Copy aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Copy this view as a link</TooltipContent>
      </Tooltip>
      {/* `output`, not a span with `role="status"`: same live region, and the
          element the linter and the platform both name for it. */}
      <output className="sr-only">{copied ? 'Copied' : ''}</output>
    </span>
  );
}
