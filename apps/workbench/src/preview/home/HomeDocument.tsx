import { ArrowDown, ArrowUp, Check, Copy, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  MINUTES_IN_DAY,
  minuteOfDay,
  type HomeLayout,
  type HomeSection,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';
import { HOME_PINS } from '@correctiv/app-core/data/home-pins';

import { SOURCES } from '../../../content/sources.manifest';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import type { PreviewState } from '../state';
import { timeOf } from './clock';
import {
  changedAt,
  differs,
  effectiveAt,
  formatLayoutDocument,
  formatTimeOfDay,
  inheritedAt,
  momentAt,
  moduleLabel,
  moved,
  movedMoment,
  pointAt,
  settingLabel,
  settingsFor,
  SHIPPED,
  spanOf,
  withHidden,
  withMoment,
  withoutMoment,
  withSetting,
  type Point,
  type SettingSpec,
} from './document';
import { getLayout, setLayout, subscribeLayout } from './store';
import { canSave, publish, save, type SaveResult } from './write';

/**
 * The home screen's document, as a day somebody can arrange.
 *
 * One tool, one registration: `shell/views.ts` declares the `home` section, the rail
 * draws its icon (`ui/ToolRail.tsx`) and `pages/Preview.tsx` fills its one slot.
 *
 * ## What it is, since ADR 0039
 *
 * The top of the panel is **the day**: a track from midnight to midnight, the moments
 * the document names as stops on it, and a playhead. Moving the playhead tells the
 * framed app what time it is (`./clock.ts`), so the app beside this panel is showing
 * what a reader would see then. Everything below the track edits **the point the
 * playhead is in** — the day's start, or the moment currently in effect — and what an
 * edit writes is a difference from the point before it, which is what the document
 * already is.
 *
 * That is the whole of why this replaced four checkboxes per block. The checkboxes could
 * say "this block appears between eleven and two" and nothing else: not a fifth point,
 * not half past six, and not "the same block, a different article in the evening". The
 * day is a sequence of changes, and an editor describing one should be writing changes.
 *
 * ## Two things it will not let itself do
 *
 * It never writes a change equal to what the point already inherits — `withHidden` and
 * `withSetting` take one out instead — so a moment's diff is what is different about it.
 * And it never says a thing on screen that is not true of the frame: the sample-data
 * marking on the article picker is read out of `content/sources.manifest.ts` rather than
 * typed here, so it disappears by itself on the day that row turns live.
 */

/** The dock's ground is `surface`, so a row inside it steps back to `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const CODE = 'rounded-s border border-stroke px-3xs font-mono text-[0.8125rem]';
const FIELD =
  'rounded-s border border-stroke bg-canvas px-3xs py-4xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * The step a drag lands on, in minutes.
 *
 * The track is about four hundred pixels wide for fourteen hundred minutes, so a pixel
 * is nearly four minutes and a free drag would write `11:03` for a click somebody made
 * at eleven. Five is the coarsest step nobody has to fight and the finest one a mouse can
 * actually hit; the time fields beside the track are where a minute is typed exactly.
 */
const STEP = 5;

const snap = (minute: number): MinuteOfDay =>
  Math.max(0, Math.min(MINUTES_IN_DAY - STEP, Math.round(minute / STEP) * STEP));

/** Where a minute sits on the track, as a CSS length. */
const percent = (value: number) => `${(value / MINUTES_IN_DAY) * 100}%`;

export function HomeDocument({
  state,
  onChange,
  outline,
}: {
  state: PreviewState;
  onChange: (patch: Partial<PreviewState>) => void;
  /** Outlines the section's element in the frame, or clears the outline on `null`. */
  outline: (id: string | null) => void;
}) {
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getLayout);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [copied, setCopied] = useState(false);

  /*
   * The machine's own clock, so the track can mark it and the app can be put back on it.
   * Read once per mount rather than ticked: this is a mark on a timeline, and a marker
   * that moved every minute would be a re-render every minute for a line nobody is
   * watching.
   */
  const [realMinute] = useState(() => minuteOfDay(Date.now()));

  const simulated = state.time;
  const minute = simulated === null ? realMinute : (parseMinute(simulated) ?? realMinute);
  const point = pointAt(layout, minute);
  const moment = momentAt(layout, point);
  const span = spanOf(layout, point);

  /*
   * Once, on arrival: a stored document that is now identical to the shipped one is a
   * key nobody can see and nobody clears, and `publish` takes it away. It is the state
   * every successful save leaves behind, because saving is what makes the two the same
   * — the file changes, Vite reloads the page, and the override is then a copy of it.
   */
  useEffect(() => publish(getLayout()), []);

  const edit = (next: HomeLayout) => {
    setLayout(next);
    // A save message is about the document that was saved, and this is not it.
    setResult(null);
    setCopied(false);
  };

  const goTo = (next: MinuteOfDay) => onChange({ time: timeOf(next) });

  const effective = effectiveAt(layout, point);
  const inherited = inheritedAt(layout, point);
  const edited = changedAt(layout, minute);
  const dirty = differs(layout);

  return (
    <>
      <p className={NOTE}>
        The home screen as a day. The track is midnight to midnight; each stop on it is a moment the
        document names, and a moment carries only what changes at it. Move the playhead and the
        frame shows that time.
      </p>

      <Timeline
        layout={layout}
        minute={minute}
        realMinute={realMinute}
        simulated={simulated !== null}
        point={point}
        onGoTo={goTo}
        onMoveMoment={(from, to) => edit(movedMoment(layout, from, to))}
      />

      <div className="flex flex-wrap items-center gap-xs">
        <label className="flex items-center gap-2xs text-s text-on-canvas">
          <span className="sr-only">The time the frame is showing</span>
          <input
            type="time"
            step={STEP * 60}
            value={formatTimeOfDay(minute)}
            onChange={(event) => {
              const next = parseMinute(event.target.value);
              if (next !== null) goTo(next);
            }}
            className={cn(FIELD, 'font-mono')}
          />
        </label>

        {/*
          "Live" is the app's own clock and it is a different state from "the simulated
          time happens to be now": the first has no `tm` in the address and writes no key,
          the second does both. Saying so with one button that is either pressed or not is
          what keeps the panel from claiming a thing the frame is not doing.
        */}
        <Button
          variant={simulated === null ? 'default' : 'outline'}
          size="sm"
          disabled={simulated === null}
          onClick={() => onChange({ time: null })}
        >
          Live
        </Button>

        {/*
          Both the test and the write are against the SNAPPED minute, because that is
          where the point would land. Against the raw one, a playhead typed to 11:02
          offers a button that then makes nothing, since 11:00 already has a moment.
        */}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={momentAt(layout, snap(minute)) !== null}
          onClick={() => {
            edit(withMoment(layout, snap(minute)));
            goTo(snap(minute));
          }}
        >
          <Plus aria-hidden="true" />
          Point here
        </Button>
      </div>

      <p className={NOTE}>
        {simulated === null ? (
          <>
            The frame is on this machine’s clock, {formatTimeOfDay(realMinute)}. Nothing is written
            to the app until you move the playhead.
          </>
        ) : (
          <>
            The frame is being told it is{' '}
            <b className="font-semibold text-on-canvas">{formatTimeOfDay(minute)}</b>. The time is
            in this page’s address, so this view is a link; Live takes it back off.
          </>
        )}
      </p>

      <PointHead
        layout={layout}
        point={point}
        span={span}
        changes={moment?.changes.length ?? 0}
        onMove={(to) => {
          if (point === null) return;
          edit(movedMoment(layout, point, to));
          goTo(to);
        }}
        onRemove={() => {
          if (point === null) return;
          edit(withoutMoment(layout, point));
        }}
      />

      <ol className="flex flex-col gap-3xs">
        {layout.sections.map((section, index) => (
          <Row
            key={section.id}
            section={effective.find((held) => held.id === section.id) ?? section}
            inherited={inherited.find((held) => held.id === section.id) ?? section}
            point={point}
            index={index}
            last={index === layout.sections.length - 1}
            changed={edited.includes(section.id)}
            onMove={(delta) => edit(moved(layout, section.id, delta))}
            onHidden={(hidden) => edit(withHidden(layout, point, section.id, hidden))}
            onSetting={(key, value) => edit(withSetting(layout, point, section.id, key, value))}
            outline={outline}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-xs">
        {/*
          `mr-auto` rather than a neighbouring spot next to Save: the two are not a
          matched pair. This one throws work away, Save writes the repository, and an
          outline button beside a filled one at the same size still reads as "pick
          either" unless something else keeps them apart.
        */}
        <Button
          variant="outline"
          size="sm"
          className="mr-auto"
          disabled={!dirty}
          onClick={() => edit(SHIPPED)}
        >
          <RotateCcw aria-hidden="true" />
          Back to the file
        </Button>

        {canSave ? (
          <Button size="sm" disabled={!dirty} onClick={() => void save(layout).then(setResult)}>
            <Save aria-hidden="true" />
            Save to the repository
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(formatLayoutDocument(layout));
              setCopied(true);
            }}
          >
            <Copy aria-hidden="true" />
            Copy the document
          </Button>
        )}

        <span className={NOTE}>{dirty ? 'changed' : 'unchanged'}</span>
      </div>

      {/*
        The difference between the two Saves is said here rather than discovered by
        pressing one. `canSave` is `import.meta.env.DEV`, so this is the published site
        telling the truth about itself, which is the shape the Tokens tool already has.
      */}
      <p className={NOTE}>
        {canSave ? (
          <>
            Save writes <code className={CODE}>packages/app-core/src/data/home.layout.json</code>{' '}
            through the dev server, which refuses anything the core will not parse. The next step is
            a pull request rather than a write, the way the sources job already does it (ADR 0036
            §15).
          </>
        ) : (
          <>
            This is the published site, so there is no server to write with and nothing here reaches
            the repository. Copy the document and put it in{' '}
            <code className={CODE}>packages/app-core/src/data/home.layout.json</code>, or open{' '}
            <code className={CODE}>/preview</code> on a dev server, where Save is offered.
          </>
        )}
      </p>

      {copied && (
        <p className="flex items-center gap-xs text-s text-on-canvas">
          <Check aria-hidden="true" className="size-[0.875rem] shrink-0" />
          Copied.
        </p>
      )}
      {/*
        A refusal is a red fill with white text, not red text on the canvas. That is what
        the console's `error` badge does two files over, and it is the treatment that
        survives the scheme flipping.
      */}
      {result && (
        <p className="flex items-start gap-xs text-s text-on-canvas">
          {result.ok ? (
            <Check aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
          ) : (
            <span className="shrink-0 rounded-s bg-red-500 px-3xs font-mono text-[0.75rem] font-semibold uppercase text-white">
              refused
            </span>
          )}
          <span className="min-w-0">{result.message}</span>
        </p>
      )}
    </>
  );
}

/** `HH:MM` to minutes, for the two `<input type="time">` fields and the address. */
function parseMinute(value: string): MinuteOfDay | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const HOURS = [0, 6, 12, 18, 24];

/**
 * The day as a track: the hours, the moments on it, the machine's clock, the playhead.
 *
 * A pointer anywhere on the track moves the playhead, including a drag, because that is
 * the gesture the whole tool is for — you pull along the day and watch the app change.
 * A pointer on a stop moves the stop instead and stops there, so the two gestures share
 * the surface without either having a mode.
 *
 * It is not the accessible control and does not pretend to be one. The time field
 * underneath is, and the selected point has a field of its own for moving it, so
 * everything the track does can be done by typing. Giving a `<div>` a slider role and
 * arrow keys would have been a third way to say the same thing, and the one nobody
 * tests.
 */
function Timeline({
  layout,
  minute,
  realMinute,
  simulated,
  point,
  onGoTo,
  onMoveMoment,
}: {
  layout: HomeLayout;
  minute: MinuteOfDay;
  realMinute: MinuteOfDay;
  simulated: boolean;
  point: Point;
  onGoTo: (minute: MinuteOfDay) => void;
  onMoveMoment: (from: MinuteOfDay, to: MinuteOfDay) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  /** Which moment a drag is carrying, by the minute it was at when the drag began. */
  const dragging = useRef<MinuteOfDay | null>(null);

  const at = (event: { clientX: number }): MinuteOfDay => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return minute;
    const share = (event.clientX - box.left) / box.width;
    return snap(Math.max(0, Math.min(1, share)) * MINUTES_IN_DAY);
  };

  return (
    <div className="select-none">
      <div
        ref={track}
        className="relative h-[3.25rem] cursor-pointer rounded-md border border-stroke bg-surface"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          if (dragging.current === null) onGoTo(at(event));
        }}
        onPointerMove={(event) => {
          if (event.buttons === 0) return;
          const to = at(event);
          const held = dragging.current;
          if (held === null) {
            onGoTo(to);
            return;
          }
          if (to !== held) {
            onMoveMoment(held, to);
            dragging.current = to;
            onGoTo(to);
          }
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        {/* The hours, as the only fixed thing on the track. */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            aria-hidden="true"
            className="absolute top-0 flex h-full flex-col justify-end"
            style={{ left: percent(hour * 60), transform: 'translateX(-50%)' }}
          >
            <span className="absolute inset-y-0 left-1/2 w-px bg-stroke" />
            <span className="relative bg-surface px-4xs text-[0.6875rem] text-on-canvas-muted">
              {String(hour).padStart(2, '0')}
            </span>
          </div>
        ))}

        {/*
          The machine's clock, drawn even while a simulated time is set, because "what
          the app would be showing if you pressed Live" is the thing a person needs to
          see next to what it is showing now.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-on-canvas-muted/50"
          style={{ left: percent(realMinute) }}
        />

        {/* The moments. A filled stop is the one in effect at the playhead. */}
        {layout.moments.map((held) => (
          <button
            key={held.minute}
            type="button"
            aria-label={`The moment at ${held.at}`}
            className={cn(
              'absolute top-2xs size-[0.875rem] cursor-grab rounded-full border-2 border-accent active:cursor-grabbing',
              held.minute === point ? 'bg-accent' : 'bg-canvas',
            )}
            style={{ left: percent(held.minute), transform: 'translateX(-50%)' }}
            onPointerDown={(event) => {
              event.stopPropagation();
              dragging.current = held.minute;
              track.current?.setPointerCapture(event.pointerId);
              onGoTo(held.minute);
            }}
          />
        ))}

        {/* The playhead, last so it is over everything it points at. */}
        <div
          aria-hidden="true"
          className={cn('absolute inset-y-0 w-[2px]', simulated ? 'bg-accent' : 'bg-on-canvas')}
          style={{ left: percent(minute), transform: 'translateX(-1px)' }}
        >
          <span
            className={cn(
              'absolute -top-4xs left-1/2 size-2xs -translate-x-1/2 rotate-45',
              simulated ? 'bg-accent' : 'bg-on-canvas',
            )}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Which point is being edited, how long it lasts, and what can be done to it.
 *
 * The day's start is not a moment and the head says so rather than dressing it up as
 * one: it cannot be moved, because there is nothing before midnight for it to inherit
 * from, and it cannot be removed, because it is the document.
 */
function PointHead({
  layout,
  point,
  span,
  changes,
  onMove,
  onRemove,
}: {
  layout: HomeLayout;
  point: Point;
  span: { from: number; to: number };
  changes: number;
  onMove: (to: MinuteOfDay) => void;
  onRemove: () => void;
}) {
  const until = span.to === MINUTES_IN_DAY ? 'midnight' : formatTimeOfDay(span.to);

  return (
    <div className={cn(CARD, 'flex flex-wrap items-center gap-xs p-xs')}>
      {point === null ? (
        <>
          <span className="text-m font-semibold text-on-canvas">The day’s start</span>
          <span className={NOTE}>
            The document as it stands, in effect from midnight until {until}. Every moment inherits
            from it.
          </span>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2xs">
            <span className="sr-only">The time of this moment</span>
            <input
              type="time"
              step={STEP * 60}
              value={formatTimeOfDay(point)}
              onChange={(event) => {
                const next = parseMinute(event.target.value);
                if (next !== null) onMove(next);
              }}
              className={cn(FIELD, 'font-mono text-m font-semibold')}
            />
          </label>
          <span className={NOTE}>
            until {until} · {changes === 0 ? 'nothing changes here yet' : `${changes} changed here`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-[2rem]"
            aria-label={`Remove the moment at ${formatTimeOfDay(point)}`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      )}
      {point === null && layout.moments.length === 0 && (
        <span className={cn(NOTE, 'w-full')}>
          This document has no moments, so the home screen is the same at every hour.
        </span>
      )}
    </div>
  );
}

/**
 * One place, in the state it is in at the point being edited.
 *
 * Every control says whether what it shows is **inherited** or **set here**, because
 * that is the one question the model asks of a person and a control that hid it would
 * make the panel a set of independent forms again. Setting a control back to what it
 * inherits takes the change out of the document, so there is no separate revert to
 * press and no way to leave a change behind that says nothing.
 */
function Row({
  section,
  inherited,
  point,
  index,
  last,
  changed: isChanged,
  onMove,
  onHidden,
  onSetting,
  outline,
}: {
  section: HomeSection;
  inherited: HomeSection;
  point: Point;
  index: number;
  last: boolean;
  changed: boolean;
  onMove: (delta: -1 | 1) => void;
  onHidden: (hidden: boolean) => void;
  onSetting: (key: string, value: string | number | null | undefined) => void;
  outline: (id: string | null) => void;
}) {
  const { name, what } = moduleLabel(section.module);
  const off = Boolean(section.hidden);
  const specs = settingsFor(section.module);
  const hiddenHere = point !== null && Boolean(inherited.hidden) !== off;

  return (
    // Nothing below makes the row operable; the handlers only relay whether the
    // pointer or the focus is somewhere inside it, and every control a person can
    // act on is one of its own buttons, checkboxes and labels.
    //
    // `outline` is called with `section.id` whether or not `off` is true, and this row
    // does not check it first. A moment can hide a place at the point being previewed —
    // `off` is exactly that fact — and the deliberate choice is to let the lookup in
    // `frame/highlight.ts` discover the absence itself: it finds no matching element and
    // clears whatever mark was there, which is the same quiet nothing a mistyped id or an
    // unrendered module would produce. The `off` badge below already tells a person the
    // row is not on screen; the outline does not need to say it twice, and a row cannot
    // drift out of sync with a mechanism it does no filtering of its own.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li
      className={cn(CARD, 'flex flex-col gap-2xs p-xs', isChanged && 'border-accent')}
      onPointerEnter={() => outline(section.id)}
      onPointerLeave={() => outline(null)}
      onFocus={() => outline(section.id)}
      onBlur={() => outline(null)}
    >
      <div className="flex min-w-0 items-start gap-xs">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2xs">
            <span
              className={cn(
                'text-m font-semibold',
                off ? 'text-on-canvas-muted' : 'text-on-canvas',
              )}
            >
              {name}
            </span>
            {off && <Badge variant="outline">off</Badge>}
            {isChanged && <Badge>changed</Badge>}
          </div>
          <div className={NOTE}>{what}</div>
        </div>

        <div className="flex shrink-0 items-center gap-4xs">
          <Button
            variant="ghost"
            size="icon"
            className="size-[2rem]"
            disabled={index === 0}
            aria-label={`Move ${name} up`}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-[2rem]"
            disabled={last}
            aria-label={`Move ${name} down`}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <label className="flex items-center gap-2xs text-s text-on-canvas">
          <input
            type="checkbox"
            checked={!off}
            onChange={(event) => onHidden(!event.target.checked)}
            className="size-[0.875rem] shrink-0 accent-accent"
          />
          Shown
        </label>
        {hiddenHere && <Here />}
        <code className={cn(CODE, 'ml-auto text-on-canvas-muted')}>{section.id}</code>
      </div>

      {specs.map((spec) => (
        <Setting
          key={spec.key}
          module={section.module}
          spec={spec}
          value={section.settings?.[spec.key]}
          inherited={inherited.settings?.[spec.key]}
          point={point}
          disabled={off}
          onSet={(value) => onSetting(spec.key, value)}
        />
      ))}
    </li>
  );
}

/** The mark that says a value is this moment's rather than something it was handed. */
function Here() {
  return (
    <span className="rounded-s bg-accent px-3xs py-4xs text-[0.6875rem] font-semibold uppercase text-white">
      set here
    </span>
  );
}

/**
 * The sources manifest's row for the pin list, which is where its marking comes from.
 *
 * `SOURCES.md` and this manifest are how this repository already tells a live source
 * from a stand-in, and the rule it enforces is that a sample row names what it stands in
 * for. So the picker reads the row rather than carrying a sentence of its own: the day
 * WordPress answers "what may lead the app today" the row turns `live`, and the marking
 * goes with it without anybody remembering this file.
 */
const PIN_SOURCE = SOURCES.find((entry) => entry.id === 'home-pins');

/** One setting, with the control its kind asks for. */
function Setting({
  module,
  spec,
  value,
  inherited,
  point,
  disabled,
  onSet,
}: {
  module: string;
  spec: SettingSpec;
  value: unknown;
  inherited: unknown;
  point: Point;
  disabled: boolean;
  onSet: (value: string | number | null | undefined) => void;
}) {
  const { name, what } = settingLabel(module, spec);
  const setHere = point !== null && value !== inherited;

  return (
    <div
      className={cn(
        'flex flex-col gap-4xs border-t border-stroke pt-2xs',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2xs">
        <span className="text-s font-medium text-on-canvas">{name}</span>
        {setHere && <Here />}
        <span className={cn(NOTE, 'ml-auto')}>{what}</span>
      </div>

      {spec.kind === 'count' ? (
        <input
          type="number"
          min={spec.min}
          max={spec.max}
          disabled={disabled}
          value={typeof value === 'number' ? value : spec.fallback}
          aria-label={name}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isInteger(next) || next < spec.min || next > spec.max) return;
            onSet(next);
          }}
          className={cn(FIELD, 'w-[5rem]')}
        />
      ) : (
        <>
          <select
            disabled={disabled}
            aria-label={name}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onSet(event.target.value === '' ? null : event.target.value)}
            className={cn(FIELD, 'w-full')}
          >
            <option value="">The newest investigation (no pin)</option>
            {HOME_PINS.map((item) => (
              <option key={item.url} value={item.url}>
                {item.title}
              </option>
            ))}
          </select>
          {PIN_SOURCE?.status === 'sample' && (
            <span className={NOTE}>
              <Badge variant="outline">sample data</Badge> These are{' '}
              <code className={CODE}>packages/app-core/src/data/home-pins.ts</code>, standing in for{' '}
              {PIN_SOURCE.standsIn}. Real articles, a fixed list, not today’s.
            </span>
          )}
        </>
      )}
    </div>
  );
}
