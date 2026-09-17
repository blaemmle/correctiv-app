import { ArrowDown, ArrowUp, Check, Copy, RotateCcw, Save } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { daypartAt } from '@correctiv/app-core/lib/daypart';
import type { HomeLayout, HomeSection } from '@correctiv/app-core/lib/home-layout';

import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import {
  changed,
  DAYPARTS,
  daypartLabel,
  daypartsOf,
  formatLayoutDocument,
  moduleLabel,
  moved,
  SHIPPED,
  toggledHidden,
  withDayparts,
  type Daypart,
} from './document';
import { getLayout, setLayout, subscribeLayout } from './store';
import { canSave, publish, save, type SaveResult } from './write';

/**
 * The home screen's document, as a list somebody can rearrange.
 *
 * One tool, one registration: `shell/views.ts` declares the `home` section, the rail
 * draws its icon (`ui/ToolRail.tsx`) and `pages/Preview.tsx` fills its one slot.
 * Everything below the head is a row per section of
 * `packages/app-core/src/data/home.layout.json`, in the document's own order, named the
 * way ADR 0036 §1 asks for — "the document is designed as though the newsroom already
 * owned it" — so the row says "Lead article" and not `article-hero`.
 *
 * **The vocabulary is four verbs and no more**: a section moves up, moves down, switches
 * off, and chooses the parts of the day it appears in. That is the whole of what the
 * grammar can express (`HomeSection` has four fields and two of them are these), so a
 * fifth control here would be a control for something the document cannot say.
 *
 * The state lives in `./store.ts`, outside this component, and the document is the only
 * copy of it. `write.ts` puts every edit into `localStorage` immediately, the framed app
 * reads it from there, and the frame redraws without a reload — so there is no preview
 * button and nothing to press to see the change.
 */

/** The dock's ground is `surface`, so a row inside it steps back to `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const CODE = 'rounded-s border border-stroke px-3xs font-mono text-[0.8125rem]';

export function HomeDocument() {
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getLayout);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [copied, setCopied] = useState(false);

  const edited = changed(layout);
  const now = daypartAt(new Date());

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

  return (
    <>
      <p className={NOTE}>
        The order of the home screen, as the app reads it. Every change is in the frame immediately;
        nothing reaches the repository until you say so.
      </p>

      <ol className="flex flex-col gap-3xs">
        {layout.sections.map((section, index) => (
          <Row
            key={section.id}
            section={section}
            index={index}
            last={index === layout.sections.length - 1}
            changed={edited.includes(section.id)}
            now={now}
            onMove={(delta) => edit(moved(layout, section.id, delta))}
            onToggle={() => edit(toggledHidden(layout, section.id))}
            onDayparts={(chosen) => edit(withDayparts(layout, section.id, chosen))}
          />
        ))}
      </ol>

      <p className={NOTE}>
        It is <b className="font-semibold text-on-canvas">{daypartLabel(now)}</b> on this machine,
        so a section restricted to another part of the day is in the document and not in the frame.
        The frame is showing what a reader would see now.
      </p>

      <div className="flex flex-wrap items-center gap-xs">
        <Button
          variant="outline"
          size="sm"
          disabled={edited.length === 0}
          onClick={() => edit(SHIPPED)}
        >
          <RotateCcw aria-hidden="true" />
          Back to the file
        </Button>

        {canSave ? (
          <Button
            size="sm"
            disabled={edited.length === 0}
            onClick={() => void save(layout).then(setResult)}
          >
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

        <span className={NOTE}>{edited.length} changed</span>
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
        survives the scheme flipping: the brand red is legible under white and thin
        against a dark ground.
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

/**
 * One section, in the words an editor would use for it.
 *
 * The module id is not drawn at all. The **section** id is, small and last, because it is
 * the document's stable address and because two rows can otherwise be the same sentence:
 * the participation callout has two places in the shipped document and they differ only
 * in their id and their hours.
 */
function Row({
  section,
  index,
  last,
  changed: isChanged,
  now,
  onMove,
  onToggle,
  onDayparts,
}: {
  section: HomeSection;
  index: number;
  last: boolean;
  changed: boolean;
  now: Daypart;
  onMove: (delta: -1 | 1) => void;
  onToggle: () => void;
  onDayparts: (chosen: ReadonlySet<Daypart>) => void;
}) {
  const { name, what } = moduleLabel(section.module);
  const chosen = daypartsOf(section);
  const always = chosen.size === DAYPARTS.length;
  const off = Boolean(section.hidden);
  // Why it is not in the frame, which is two different reasons and worth saying apart.
  const absent = off || !chosen.has(now);

  return (
    <li className={cn(CARD, 'flex flex-col gap-2xs p-xs', isChanged && 'border-accent')}>
      <div className="flex min-w-0 items-start gap-xs">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2xs">
            <span
              className={cn(
                'text-m font-semibold',
                absent ? 'text-on-canvas-muted' : 'text-on-canvas',
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
            onChange={onToggle}
            className="size-[0.875rem] shrink-0 accent-accent"
          />
          Shown
        </label>

        {/* A fieldset rather than a div with a role: these are a set, several can be
            on, and a checkbox is what says so. Disabled with the section, because the
            hours of a section nobody sees are not a question. */}
        <fieldset disabled={off} className="min-w-0 disabled:opacity-60">
          <legend className="sr-only">When {name} appears</legend>
          <div className="flex flex-wrap items-center gap-4xs">
            {DAYPARTS.map((part) => (
              <label
                key={part}
                className={cn(
                  'cursor-pointer rounded-s border px-3xs py-4xs text-s transition-colors',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent',
                  chosen.has(part)
                    ? 'border-accent text-on-canvas'
                    : 'border-stroke text-on-canvas-muted',
                  part === now && 'font-semibold',
                )}
              >
                <input
                  type="checkbox"
                  checked={chosen.has(part)}
                  onChange={() => {
                    const next = new Set(chosen);
                    if (next.has(part)) next.delete(part);
                    else next.add(part);
                    onDayparts(next);
                  }}
                  className="sr-only"
                />
                {daypartLabel(part)}
              </label>
            ))}
            <span className={NOTE}>{always ? 'always' : 'these hours only'}</span>
          </div>
        </fieldset>

        <code className={cn(CODE, 'ml-auto text-on-canvas-muted')}>{section.id}</code>
      </div>
    </li>
  );
}
