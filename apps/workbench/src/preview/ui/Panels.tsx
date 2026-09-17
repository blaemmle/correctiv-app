import {
  Check,
  Copy,
  Crosshair,
  Eraser,
  ExternalLink,
  OctagonAlert,
  Play,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { COMBINATIONS, type Status } from '../api';
import type { Level, LogEntry } from '../frame/console';
import { frameLabel, frameShort, handover } from '../handover';
import type { Located } from '../frame/locate';
import type { Finding } from '../frame/measure';
import { FIXTURES } from '../frame/seed';
import { asCss, PALETTE, TOKENS, type Overrides, type Scheme } from '../frame/tokens';
import type { PreviewState, ThemeSetting } from '../state';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import { Segmented } from '../../ui/kit/segmented';

export interface ToolBindings {
  scheme: Scheme;
  tokens: {
    overrides: Overrides;
    set: (next: Overrides) => void;
    textPass: boolean;
    setTextPass: (on: boolean) => void;
  };
  measure: {
    outline: boolean;
    setOutline: (on: boolean) => void;
    report: { findings: Finding[]; scheme: Scheme; scanned: number } | null;
    run: () => void;
  };
  inspect: {
    picking: boolean;
    setPicking: (on: boolean) => void;
    hit: { label: string; frames: Located[] } | null;
    /** Which frame of the owner chain the person meant. */
    selected: number;
    setSelected: (index: number) => void;
    open: (frame: Located) => void;
  };
}

/**
 * What each of the preview's six tools is handed.
 *
 * These used to be one `Props` and a `Panel` wrapper each, and this file owned
 * which of them were open — a comment here said so: "which panels are open is
 * local to this component". It is in the address on every route now
 * (`shell/address.ts`), the chrome is `ui/ToolRail.tsx` and `ui/ToolPanel.tsx`,
 * and what is left here is six bodies and the two numbers that go on the rail.
 * ADR 0028 records the first move and ADR 0038 the second.
 */
interface Props {
  state: PreviewState;
  status: Status;
  logs: LogEntry[];
  tools: ToolBindings;
  onChange: (patch: Partial<PreviewState>) => void;
  onClearLogs: () => void;
}

/**
 * A readout inside the panel: the panel's own `canvas` behind a `stroke` border,
 * rather than a second shade. Two roles and no shades at all is what keeps the
 * whole panel legible when the scheme flips.
 */
const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
/** An identifier in a sentence. A border rather than a fill, so it reads on both grounds. */
const CODE = 'rounded-s border border-stroke px-3xs font-mono text-[0.8125rem]';
const SEG = 'inline-flex flex-wrap gap-4xs rounded-md border border-stroke bg-canvas p-4xs';

/**
 * One toggle in the console's level filter, which is the only place left that
 * wants this shape and buttons at once.
 *
 * `aria-pressed` is right here and was wrong on the two exclusive choices that
 * used to share this helper: the levels are a set, several can be on, and
 * "warnings are showing" is exactly what pressed means. Those two are
 * `ui/kit/segmented.tsx` now.
 */
function segment(on: boolean): string {
  return cn(
    'rounded-s px-xs py-3xs text-s font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
    on ? 'bg-accent text-white' : 'text-on-canvas-muted hover:bg-surface hover:text-on-canvas',
  );
}

/**
 * A count, always with its number and the word it counts written out, never a
 * colour on its own.
 *
 * Three things separate a warning from an error at once: the shape of the icon,
 * the word beside the number, and the fill. The fill alone would fail for a
 * reader who cannot see it and for anyone reading a greyscale screenshot, which
 * is how most of this tool's output travels. The word is left off where the row
 * beside the badge already names what is being counted.
 */
function Count({ n, tone, label }: { n: number; tone: 'warn' | 'err'; label?: string }) {
  const suffix = label ? ` ${label}` : '';
  if (n === 0) {
    return (
      <Badge variant="outline" className="tabular-nums">
        <Check aria-hidden="true" className="size-[0.75rem]" />
        {n}
        {suffix}
      </Badge>
    );
  }
  const Icon = tone === 'err' ? OctagonAlert : TriangleAlert;
  return (
    <Badge
      className={cn(
        'border-transparent tabular-nums',
        // Neither of these follows the scheme, and that is the point: a hazard
        // mark that changed colour with the page would stop being a hazard mark.
        // The ink on each is the one the palette fixes for it.
        tone === 'err' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-neutral-700',
      )}
    >
      <Icon aria-hidden="true" className="size-[0.75rem]" />
      {n}
      {suffix}
    </Badge>
  );
}

/**
 * A number on a tool's icon in the rail, and nothing at all when there is none.
 *
 * The rail is always on screen, so what sits on it is always on screen, and the
 * badges this replaces were mostly announcements that nothing had happened:
 * `untouched`, `inert here`, `combination unknown`, `findings, not run`. Two
 * survive, warnings-or-errors and findings, and both of those draw nothing at
 * zero — a clean run is the ordinary case and a permanent chip saying so is a
 * permanent chip. The exact split is in the tool, which is one press away.
 *
 * `title` rather than a tooltip: the rail button already owns one, and a second
 * trigger inside the first is two popups on one hover.
 */
function Mark({ n, tone, label }: { n: number; tone: 'warn' | 'err'; label: string }) {
  if (n === 0) return null;
  return (
    <span
      title={`${n} ${label}`}
      className={cn(
        'min-w-[1rem] rounded-full px-4xs text-center font-mono text-[0.625rem] font-semibold leading-[1rem] tabular-nums',
        tone === 'err' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-neutral-700',
      )}
    >
      {n > 99 ? '99+' : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/**
 * Why a control above it is disabled, said in words next to the control.
 *
 * Rendered only where the dev handle is absent, which is the same condition that
 * disables the control, so the reason and the disabled state cannot drift apart.
 * This is also where the whole of that fact lives now. The panel used to open
 * with a build line and a paragraph under it — "Store handle absent, the
 * appearance setting and the inspector are inert" — which is true, and was
 * printed above six tools of which it concerns two. The status line says which
 * build is in the frame; the two tools it disables say so themselves, here.
 * ([ADR 0038](../../../../../adr/0038-one-tool-at-a-time-in-a-rail.md))
 */
function NeedsDev({ children }: { children: ReactNode }) {
  return (
    <div className={cn(CARD, 'flex flex-col gap-2xs p-xs')}>
      <Badge className="self-start border-transparent bg-yellow-400 text-neutral-700">
        <TriangleAlert aria-hidden="true" className="size-[0.75rem]" />
        Needs a development build
      </Badge>
      <p className={NOTE}>{children}</p>
    </div>
  );
}

const SETTINGS: ThemeSetting[] = ['light', 'dark', 'system'];

/**
 * The two grounds a device scheme means.
 *
 * Written out rather than taken from the palette, and that is the point: these
 * stand for the scheme the *device* reports, so they must not follow the one this
 * page is painted in. The token package has no name for "the dark canvas as a
 * fixed value", which is the boundary AGENTS.md describes, where the app says
 * `always-dark` and the package says nothing. palette-exempt.
 */
const SWATCH = { light: '#ffffff', dark: '#1a1a1a' }; // palette-exempt

/**
 * All four combinations of appearance setting and device scheme, named.
 *
 * `TROUBLESHOOTING.md`: "Check a colour change in all three settings, and check
 * `'system'` against both device schemes. That is four combinations, and only the
 * fourth was broken." The fourth is also the app's default, which is why it is
 * marked here rather than left to be counted.
 *
 * The shell can only set the inner half. `prefers-color-scheme` cannot be forced
 * per iframe, so 3 and 4 need the browser's own emulation, and this panel says
 * which one is on screen rather than pretending to have got you there. The four
 * are a readout for that reason; the setting, which is the half this page can
 * write, is the segmented control above them. Each row carries where it is
 * reached — `here` or `DevTools` — as a chip rather than as the sentence it used
 * to carry, which said the same thing four times.
 */
export function Appearance({ status, onChange }: Props) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-xs">
        <div className={cn(CARD, 'min-w-0 px-xs py-2xs')}>
          <dt className="text-s text-on-canvas-muted">App setting says</dt>
          <dd className="mt-4xs truncate font-mono text-m text-on-canvas">
            {status.appTheme ?? 'unknown'}
          </dd>
        </div>
        <div className={cn(CARD, 'min-w-0 px-xs py-2xs')}>
          <dt className="text-s text-on-canvas-muted">Device reports</dt>
          <dd className="mt-4xs flex min-w-0 items-center gap-2xs font-mono text-m text-on-canvas">
            <span
              className="size-[0.625rem] shrink-0 rounded-full border border-stroke-strong"
              style={{ background: SWATCH[status.scheme ?? 'light'] }}
              aria-hidden="true"
            />
            <span className="truncate">{status.scheme ?? 'unknown'}</span>
          </dd>
        </div>
      </dl>

      <Segmented
        name="app-theme"
        legend="App setting"
        showLegend
        disabled={!status.handle}
        value={status.appTheme ?? ''}
        options={SETTINGS.map((setting) => ({ value: setting, label: setting }))}
        onChange={(value) => onChange({ theme: value as ThemeSetting })}
      />

      {!status.handle && (
        <NeedsDev>
          <code className={CODE}>expo export</code> sets <code className={CODE}>__DEV__</code>{' '}
          false, so the published build leaves no dev handle and this setting cannot be written from
          here. Run the workbench against <code className={CODE}>npm run web</code>.
        </NeedsDev>
      )}

      <ol className="flex flex-col gap-3xs">
        {COMBINATIONS.map((c) => {
          const active = status.combination === c.n;
          return (
            <li
              key={c.n}
              aria-current={active}
              className={cn(
                CARD,
                'flex min-w-0 flex-wrap items-center gap-2xs px-xs py-2xs',
                active && 'border-accent',
              )}
            >
              <span className="shrink-0 font-mono text-m tabular-nums text-on-canvas-muted">
                {c.n}
              </span>
              <span className="min-w-0 flex-1 text-m text-on-canvas">{c.label}</span>
              {c.isDefault && <Badge variant="alt">default</Badge>}
              {active && <Badge variant="accent">on screen</Badge>}
              <Badge variant="outline">{c.scheme === undefined ? 'here' : 'DevTools'}</Badge>
            </li>
          );
        })}
      </ol>

      <p className={NOTE}>
        An iframe cannot be given a scheme of its own, so the two marked DevTools are reached by
        emulating <code className={CODE}>prefers-color-scheme</code> under Rendering.
      </p>
    </>
  );
}

/**
 * Storage fixtures. Each is a whole state rather than a patch, and each costs a
 * reload: `onboardingDone` and the feed cache are both read before the first
 * render, so neither can be dispatched after the fact.
 *
 * The design marks this panel as needing a development build, and it does not:
 * a fixture is written to `window.localStorage`, which same-origin makes the
 * app's own, before the frame is pointed at a route. That works in the static
 * export, so nothing here warns about the build.
 */
export function State({ state, onChange }: Props) {
  return (
    <>
      <fieldset className="min-w-0">
        <legend className={cn(NOTE, 'mb-2xs')}>Fixture · choosing one reloads the frame</legend>
        <div className="flex flex-col gap-3xs">
          {/*
            First, and the default, because the plain demo link carries no
            fixture: `preview` with no `s` must not wipe what the last visit left
            in storage on its way in.
          */}
          <Fixture
            label="Leave alone"
            hint="Whatever the last visit left in storage."
            value=""
            checked={state.seed === null}
            onSelect={() => onChange({ seed: null })}
          />
          {FIXTURES.map((f) => (
            <Fixture
              key={f.id}
              label={f.label}
              hint={f.hint}
              value={f.id}
              checked={state.seed === f.id}
              onSelect={() => onChange({ seed: f.id })}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** One fixture, as a real radio, so the group behaves like a group under the arrow keys. */
function Fixture({
  label,
  hint,
  value,
  checked,
  onSelect,
}: {
  label: string;
  hint: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      aria-label={label}
      className={cn(
        CARD,
        'flex cursor-pointer items-start gap-xs p-xs',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
        checked && 'border-accent',
      )}
    >
      <input
        type="radio"
        name="wb-fixture"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-4xs size-[0.875rem] shrink-0 accent-accent"
      />
      <div className="min-w-0">
        <div className="text-m font-semibold text-on-canvas">{label}</div>
        <div className={NOTE}>{hint}</div>
      </div>
    </label>
  );
}

const LEVELS: Level[] = ['warn', 'error'];

/**
 * What the app said. A screenshot cannot show this, which is why it is here.
 *
 * The frame's console is patched for two levels only, so the design's third
 * filter has nothing to filter: an `error` and a `warn` are what
 * `frame/console.ts` collects, and a button for `log` would switch a category
 * that can never arrive.
 */
/**
 * One number on the icon, and it is the worse of the two.
 *
 * An error outranks a warning, so a run with both shows the errors: the rail has
 * room for one mark, and the one worth interrupting somebody for is the one that
 * goes on it. The split is the first thing the tool prints.
 */
export function ConsoleMark({ status }: Props) {
  return status.errors > 0 ? (
    <Mark n={status.errors} tone="err" label="errors" />
  ) : (
    <Mark n={status.warnings} tone="warn" label="warnings" />
  );
}

export function Console({ status, logs, onClearLogs }: Props) {
  const [levels, setLevels] = useState<ReadonlySet<Level>>(() => new Set(LEVELS));
  const [filter, setFilter] = useState('');

  const needle = filter.trim().toLowerCase();
  const shown = logs.filter(
    (entry) =>
      levels.has(entry.level) && (needle === '' || entry.text.toLowerCase().includes(needle)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-xs">
        {/* A fieldset rather than a div carrying `role="group"`: `prefer-tag-over-role`
            asks for the element, and the legend is the group's name either way. */}
        <fieldset className={SEG}>
          <legend className="sr-only">Levels shown</legend>
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={levels.has(level)}
              onClick={() =>
                setLevels((current) => {
                  const next = new Set(current);
                  if (!next.delete(level)) next.add(level);
                  return next;
                })
              }
              className={segment(levels.has(level))}
            >
              {level}
            </button>
          ))}
        </fieldset>
        <input
          type="search"
          placeholder="filter"
          aria-label="Filter console lines"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={cn(
            CARD,
            'min-w-[5rem] flex-1 px-xs py-3xs font-mono text-s text-on-canvas',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        />
        <Button variant="outline" size="sm" onClick={onClearLogs} disabled={logs.length === 0}>
          <Eraser aria-hidden="true" />
          Clear
        </Button>
      </div>

      {/*
        A plain scroller, not Radix's `ScrollArea`: that wraps its content in a
        box which sizes to the content, and a line that can be as wide as it likes
        never truncates. These lines are single-line on purpose, with the whole
        text on the row's title for the one that matters.
      */}
      <div
        role="log"
        aria-live="polite"
        aria-label="App console"
        className={cn(CARD, 'max-h-[16rem] overflow-y-auto overflow-x-hidden p-4xs')}
      >
        {shown.length === 0 ? (
          <p className={cn(NOTE, 'px-xs py-2xs')}>
            {logs.length === 0
              ? 'Nothing since the last navigation.'
              : 'Nothing matches the filter.'}
          </p>
        ) : (
          shown.map((entry) => (
            <div key={entry.id} className="flex min-w-0 items-baseline gap-xs px-3xs py-4xs">
              <span
                className={cn(
                  'shrink-0 rounded-s px-3xs font-mono text-[0.75rem] font-semibold uppercase',
                  entry.level === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-yellow-400 text-neutral-700',
                )}
              >
                {entry.level}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-s" title={entry.text}>
                {entry.text}
              </span>
            </div>
          ))
        )}
      </div>

      <p className={NOTE}>
        {shown.length} of {logs.length} lines shown, {status.warnings} warnings, {status.errors}{' '}
        errors.
      </p>
    </>
  );
}

/**
 * The palette, live. Changing a value here recolours the running app; nothing is
 * written to `tokens/theme.css`, which is vendored from `wp-design-tokens` and
 * stays the source of truth. Copy takes the result there.
 *
 * Nothing here warns about the build, unlike the design: the override is a
 * stylesheet appended to the frame's own document, which same-origin allows in
 * any build.
 */
export function Tokens({ tools }: Props) {
  const { scheme, tokens } = tools;
  const changed = TOKENS.filter((t) => tokens.overrides[t]?.[scheme]);

  const setToken = (token: (typeof TOKENS)[number], value: string | null) => {
    const next: Overrides = { ...tokens.overrides, [token]: { ...tokens.overrides[token] } };
    if (value) next[token]![scheme] = value;
    else delete next[token]![scheme];
    tokens.set(next);
  };

  return (
    <>
      <p className={NOTE}>
        Overriding the <b className="font-semibold text-on-canvas">{scheme}</b> scheme, which is the
        one the app is painting with.
      </p>

      <div className="flex flex-col gap-3xs">
        {TOKENS.map((token) => {
          const override = tokens.overrides[token]?.[scheme];
          const value = override ?? PALETTE[scheme][token];
          return (
            <label
              key={token}
              className={cn(
                CARD,
                'flex min-w-0 cursor-pointer items-center gap-xs px-xs py-3xs',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                override && 'border-accent',
              )}
            >
              <input
                type="color"
                value={value}
                onChange={(e) => setToken(token, e.target.value)}
                className="size-[1.25rem] shrink-0 cursor-pointer rounded-s border border-stroke bg-canvas p-0"
              />
              <code className="min-w-0 flex-1 truncate font-mono text-s text-on-canvas">
                --color-{token}
              </code>
              {override && <Badge variant="outline">changed</Badge>}
              <span className="shrink-0 font-mono text-s tabular-nums text-on-canvas-muted">
                {value}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Button
          variant="outline"
          size="sm"
          disabled={!changed.length}
          onClick={() => tokens.set({})}
        >
          <RotateCcw aria-hidden="true" />
          Reset overrides
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!changed.length}
          onClick={() => void navigator.clipboard.writeText(asCss(tokens.overrides))}
        >
          <Copy aria-hidden="true" />
          Copy CSS
        </Button>
        <span className={NOTE}>{changed.length} changed</span>
      </div>

      <label className="flex items-center gap-xs text-m text-on-canvas">
        <input
          type="checkbox"
          checked={tokens.textPass}
          onChange={(e) => tokens.setTextPass(e.target.checked)}
          className="size-[0.875rem] shrink-0 accent-accent"
        />
        Text too
      </label>
      {/* The caveat, and it is one clause because it is one fact: text and icons
          are resolved in JavaScript and land in inline styles, so nothing can
          follow the variable for them and this chases the old value instead. */}
      <p className={NOTE}>Text is chased by value, so it is a best effort rather than a rule.</p>
    </>
  );
}

/**
 * The three checks, as a name and a count each.
 *
 * Each of these carried a second line saying what it meant — "Anything wider than
 * the frame it is drawn in", and two more like it — which is three sentences
 * above a list of the findings themselves, each of which names what it found. The
 * titles say enough; the findings say the rest.
 */
const CHECKS: { kind: Finding['kind']; title: string }[] = [
  { kind: 'overflow', title: 'Horizontal overflow' },
  { kind: 'tap-target', title: 'Tap targets under 44 px' },
  { kind: 'off-palette', title: 'Colours off the palette' },
];

const KIND_LABEL: Record<Finding['kind'], string> = {
  overflow: 'overflow',
  'tap-target': 'tap target',
  'off-palette': 'colour',
};

/** The mechanical half of looking: overflow, tap targets, colours off the palette. */
export function MeasureMark({ tools }: Props) {
  return <Mark n={tools.measure.report?.findings.length ?? 0} tone="warn" label="findings" />;
}

export function Measure({ tools }: Props) {
  const { measure } = tools;
  const report = measure.report;
  const count = (kind: Finding['kind']) =>
    report ? report.findings.filter((f) => f.kind === kind).length : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-xs">
        <Button size="sm" onClick={measure.run}>
          <Play aria-hidden="true" />
          Run checks
        </Button>
        {/* The variant carries the pressed state as well as `aria-pressed`,
            because an outline button tinted with `surface` would be tinted the
            dock's own ground and so would look exactly like the off state. */}
        <Button
          variant={measure.outline ? 'default' : 'outline'}
          size="sm"
          aria-pressed={measure.outline}
          onClick={() => measure.setOutline(!measure.outline)}
        >
          Outline boxes
        </Button>
        {report && <span className={NOTE}>Ran across {report.scanned} elements.</span>}
      </div>

      {/* Counted only after a run. A column of "not run" beside three check names
          is a column saying nothing, three times, above the button that would
          change it. */}
      <ul className="flex flex-col gap-3xs">
        {CHECKS.map((check) => {
          const n = count(check.kind);
          return (
            <li
              key={check.kind}
              className={cn(CARD, 'flex items-center gap-xs px-xs py-2xs text-m text-on-canvas')}
            >
              <span className="min-w-0 flex-1">{check.title}</span>
              {n !== null && <Count n={n} tone="warn" />}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3xs">
        {report !== null && report.findings.length === 0 && (
          <p className={NOTE}>Nothing found across {report.scanned} elements.</p>
        )}
        {report?.findings.map((f) => (
          <div
            key={`${f.kind}:${f.where}:${f.text}`}
            className={cn(CARD, 'flex min-w-0 flex-col gap-4xs px-xs py-2xs')}
          >
            <div className="flex min-w-0 items-center gap-xs">
              <Badge variant="outline">{KIND_LABEL[f.kind]}</Badge>
              <span className="min-w-0 flex-1 text-s text-on-canvas">{f.text}</span>
            </div>
            {f.where && (
              <code
                title={f.where}
                className="block truncate font-mono text-[0.8125rem] text-on-canvas-muted"
              >
                {f.where}
              </code>
            )}
          </div>
        ))}
      </div>

      {report?.scheme === 'light' && (
        <p className={NOTE}>
          Colours are ambiguous in light: several tokens share #ffffff, several share #333333, and a
          value match cannot say which was meant. Re-run in dark, where the palette spreads over
          more distinct values.
        </p>
      )}
    </>
  );
}

/**
 * Click a thing, get the line that drew it, and hand both to someone else.
 *
 * The owner chain is offered rather than resolved, because only the person
 * looking knows which level they mean: "this chip" and "the row of chips" are two
 * entries of the same chain. The selected one becomes `Source:` in the block
 * below, the rest become `Context:`.
 */
export function Inspect({ status, tools }: Props) {
  const { inspect } = tools;
  const section = useRef<HTMLDivElement>(null);

  // The panel scrolls, and this tool is the one that grows: on a laptop the
  // result of a pick lands below the fold, which would hide the only part of the
  // interaction that matters.
  useEffect(() => {
    if (inspect.hit) section.current?.scrollIntoView({ block: 'nearest' });
  }, [inspect.hit]);

  const frames = inspect.hit?.frames ?? [];
  const chosen = frames[inspect.selected] ?? frames[0];
  const block =
    inspect.hit && frames.length > 0
      ? handover({
          label: inspect.hit.label,
          frames,
          selected: inspect.selected,
          view: location.href,
        })
      : '';

  return (
    <div ref={section} className="flex flex-col gap-s">
      {!status.handle && (
        <NeedsDev>
          The source line comes from the owner stack React keeps beside each node, and a production
          bundle keeps none. The picker stays disarmed here.
        </NeedsDev>
      )}

      <fieldset disabled={!status.handle} className="flex flex-col gap-s disabled:opacity-60">
        <div>
          <Button
            variant={inspect.picking ? 'default' : 'outline'}
            size="sm"
            aria-pressed={inspect.picking}
            onClick={() => inspect.setPicking(!inspect.picking)}
          >
            <Crosshair aria-hidden="true" />
            {inspect.picking ? 'Picker armed, click in the frame' : 'Pick element'}
          </Button>
        </div>

        <p className={cn(CARD, 'min-w-0 truncate px-xs py-2xs font-mono text-s text-on-canvas')}>
          {inspect.hit
            ? inspect.hit.label
              ? `"${inspect.hit.label}"`
              : 'Element with no label'
            : 'Nothing chosen.'}
        </p>

        {inspect.hit && frames.length === 0 && (
          <p className={NOTE}>
            No source: either nothing in this node&apos;s owner chain is app code, or the bundle
            keeps no owner stacks at all, which is every production build.
          </p>
        )}

        {frames.length > 0 && (
          <>
            <fieldset className="min-w-0">
              <legend className={cn(NOTE, 'mb-2xs')}>Source stack, innermost first</legend>
              <div className="flex flex-col gap-3xs">
                {frames.map((f, index) => (
                  <label
                    key={`${f.file}:${f.lineNumber}:${f.column}`}
                    aria-label={frameLabel(f)}
                    className={cn(
                      CARD,
                      'flex min-w-0 cursor-pointer items-start gap-xs px-xs py-2xs',
                      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                      index === inspect.selected && 'border-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="wb-frame"
                      checked={index === inspect.selected}
                      onChange={() => inspect.setSelected(index)}
                      className="mt-4xs size-[0.875rem] shrink-0 accent-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <code className="block truncate font-mono text-s text-on-canvas">
                        {frameShort(f)}
                        {f.methodName ? ` · ${f.methodName}` : ''}
                      </code>
                      <span className={cn(NOTE, 'block truncate')} title={frameLabel(f)}>
                        {frameLabel(f)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* A textarea rather than a `pre`, so the text can be selected and
                  scrolled by someone who would rather not press the button. */}
            <textarea
              readOnly
              rows={5}
              value={block}
              aria-label="Handover block"
              className={cn(
                CARD,
                'w-full resize-y p-xs font-mono text-s text-on-canvas',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              )}
            />
            <div className="flex flex-wrap items-center gap-xs">
              <Button size="sm" onClick={() => void navigator.clipboard.writeText(block)}>
                <Copy aria-hidden="true" />
                Copy for agent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!chosen}
                onClick={() => chosen && inspect.open(chosen)}
              >
                <ExternalLink aria-hidden="true" />
                Open in editor
              </Button>
            </div>
            {/* What the block is for, in the one clause that is not obvious from
                reading it: the view's own address is in there, so whoever picks
                this up can put the same thing back on screen. */}
            <p className={NOTE}>The block carries this view&apos;s address.</p>
          </>
        )}
      </fieldset>
    </div>
  );
}
