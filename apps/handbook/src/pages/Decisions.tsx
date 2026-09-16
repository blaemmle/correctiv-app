import { CircleCheck, OctagonX, Strikethrough, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import docsModule from 'virtual:docs';

import type { DecisionRecord, Standing } from '../../plugin/decisions.ts';
import { cn } from '../lib/cn';
import { href } from '../router';
import { Slot } from '../shell/slots';
import { Badge } from '../ui/kit/badge';
import { Button } from '../ui/kit/button';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';

/**
 * A measured figure — a record number, a date, a count — never wrapped.
 *
 * The same rule as the sources board, for the same reason: a date broken across
 * two lines in a narrow column reads as two numbers.
 */
const FIGURE = 'whitespace-nowrap font-mono tabular-nums';

const LINK =
  'rounded-s underline decoration-accent underline-offset-2 hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** What a record chip adds to the kit's outline badge, which it otherwise is. */
const CHIP_LINK =
  'font-mono tabular-nums hover:border-accent hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const SECTION_HEAD = 'text-headline-l font-semibold tracking-tight text-on-canvas';
const SECTION_LEDE = 'mt-2xs max-w-content text-m text-on-canvas-muted';

const RECORDS: DecisionRecord[] = docsModule.decisions;
const BY_NUMBER = new Map(RECORDS.map((record) => [record.number, record]));

interface StandingLook {
  Icon: LucideIcon;
  /** What a reader sees and what a screen reader hears, the same words. */
  label: string;
  /** The chip, which carries the weight: filled, outlined, coloured. */
  chip: string;
  /** What this state means, once, for the tile and the legend. */
  meaning: string;
}

/**
 * The three standings, each distinguishable three ways over.
 *
 * Icon, written label and weight of chip, so the board reads in greyscale and to
 * a reader who receives no colour — the sources board's rule, kept here because
 * it is the same board's house style and the same accessibility argument.
 *
 * The weights say what the states are worth. `stands` is filled, the way the
 * sources board fills `live`: it is the plain positive, and there is no green in
 * the design tokens to spend on it. `partly-struck` is outlined and quiet on
 * purpose, although it is half the set — a struck claim is this repository's
 * discipline working, not damage, and sixteen alarming chips would say the
 * opposite of what is true. Red is spent once, on the one record whose own status
 * line is struck through, because that is the only row here a reader could act on
 * and be wrong.
 */
const STANDING_LOOK: Record<Standing, StandingLook> = {
  stands: {
    Icon: CircleCheck,
    label: 'Stands',
    chip: 'border-transparent bg-on-canvas text-canvas',
    meaning: 'Nothing in them has been made false since they were written.',
  },
  'partly-struck': {
    Icon: Strikethrough,
    label: 'Partly struck',
    chip: 'border-stroke bg-surface text-on-canvas-muted',
    meaning:
      'The decision holds. Claims inside it do not, and are struck where they stand rather than rewritten.',
  },
  withdrawn: {
    Icon: OctagonX,
    label: 'No longer stands',
    chip: 'border-transparent bg-accent text-white',
    meaning: 'The status line itself is struck through. Read the record as history.',
  },
};

const ORDER: Standing[] = ['stands', 'partly-struck', 'withdrawn'];

function StandingMark({ standing, className }: { standing: Standing; className?: string }) {
  const look = STANDING_LOOK[standing];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-3xs whitespace-nowrap rounded-full border px-xs py-4xs text-s font-medium',
        look.chip,
        className,
      )}
    >
      <look.Icon aria-hidden="true" className="size-[0.875rem] shrink-0" />
      {look.label}
    </span>
  );
}

/**
 * The caveat a row wears under its title: `iOS unrun`, `not built`.
 *
 * Club yellow, the palette role the sources board gives to a thing that has
 * stopped rather than broken, and deliberately not a second status pill: the
 * status is a decision about what to do, and this is a fact about the world that
 * the decision has not changed. `text-neutral-700` on the yellow is a primitive on
 * purpose, because ink on a brand colour must not follow the scheme.
 */
function Caveat({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-3xs rounded-s bg-accent-alternative px-3xs py-4xs text-s font-medium text-neutral-700">
      <TriangleAlert aria-hidden="true" className="size-[0.875rem] shrink-0" />
      {text}
    </span>
  );
}

/** A record number as a chip that jumps to its row. */
function recordChips(numbers: string[], reveal: (number: string) => void): ReactNode {
  return numbers.map((number) => (
    <Badge asChild variant="outline" className={CHIP_LINK} key={number}>
      <a href={`#rec-${number}`} onClick={() => reveal(number)}>
        {number}
        <span className="sr-only">
          , ADR {number}, {BY_NUMBER.get(number)?.title ?? ''}
        </span>
      </a>
    </Badge>
  ));
}

/** Lower-cased haystack for the text filter: everything a reader might type. */
function haystack(record: DecisionRecord): string {
  return [
    record.number,
    record.title,
    record.date,
    record.status,
    record.note,
    ...record.caveats,
    ...record.struck.flatMap((claim) => [claim.claim, claim.clause]),
    ...record.voidedBy,
    ...record.voids,
  ]
    .join(' ')
    .toLowerCase();
}

const TEXT = new Map(RECORDS.map((record) => [record.number, haystack(record)]));

const COUNT: Record<Standing | 'all', number> = {
  all: RECORDS.length,
  stands: RECORDS.filter((r) => r.standing === 'stands').length,
  'partly-struck': RECORDS.filter((r) => r.standing === 'partly-struck').length,
  withdrawn: RECORDS.filter((r) => r.standing === 'withdrawn').length,
};

const STRUCK = RECORDS.reduce((total, record) => total + record.struck.length, 0);
/**
 * Struck claims whose clause names no later record.
 *
 * Printed on the page rather than hidden, because it is the honest limit of the
 * graph below: those claims were struck by a re-measurement, or by a later section
 * of the same record, and no amount of parsing turns that into an edge. The clause
 * still says which, and the row's detail prints it.
 */
const UNATTRIBUTED = RECORDS.reduce(
  (total, record) =>
    total +
    record.struck.filter((claim) => claim.by.every((number) => number <= record.number)).length,
  0,
);
/** The records a reader would be wrong to take at face value, in number order. */
const CAREFUL = RECORDS.filter(
  (record) => record.standing === 'withdrawn' || record.caveats.length > 0,
);

interface TileProps {
  value: 'all' | Standing;
  /** Repeats the heading word for word, so what is heard and what is read agree. */
  name: string;
  count: number;
  checked: boolean;
  onSelect: () => void;
  standing?: Standing;
  children: ReactNode;
}

/**
 * One filter tile, which is a radio wearing a card.
 *
 * The same control as the sources board, and the `aria-label` does the same real
 * work: the label is the whole card, so without it the radio announces as its own
 * count and its own summary, which is a paragraph where a name belongs.
 */
function Tile({ value, name, count, checked, onSelect, standing, children }: TileProps) {
  return (
    <label className="min-w-0" aria-label={name}>
      <input
        type="radio"
        name="standing"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex h-full cursor-pointer flex-col gap-2xs rounded-md border p-s transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
          checked ? 'border-accent bg-surface' : 'border-stroke bg-canvas hover:bg-surface',
        )}
      >
        <span className="flex items-center gap-xs">
          {standing ? (
            <StandingMark standing={standing} />
          ) : (
            <span className="text-m font-medium text-on-canvas">{name}</span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'text-headline-xxl leading-tighter tabular-nums',
            checked ? 'font-bold text-on-canvas' : 'font-semibold text-on-canvas-muted',
          )}
        >
          {count}
        </span>
        <span className="text-s leading-normal text-on-canvas-muted">{children}</span>
      </span>
    </label>
  );
}

/**
 * The decisions board: which records still hold, which carry dead claims, and who
 * killed them.
 *
 * The three questions are the ones this repository's ADR discipline creates and no
 * generic document viewer can answer. A record is never rewritten to look right in
 * hindsight: a claim a later decision made false is struck through where it stands,
 * with one clause naming what voided it. That makes the strikes content, and until
 * this page existed every one of them was invisible unless you opened the file.
 *
 * Every figure, chip, count and edge here is read out of `adr/*.md` at build time
 * by `plugin/decisions.ts`, which throws rather than hand over an empty set. The
 * handbook holds no copy of any record, so the board cannot disagree with them.
 *
 * What a row deliberately does not carry: the index's sentence about the record
 * (it runs to fifty words on some rows and would make the board three lines tall),
 * the records this one voided claims in (every such edge is another row's incoming
 * edge, so drawing both would draw the graph twice), and the record's own status
 * word where it is the usual `accepted`. All three are in the detail.
 */
export function Decisions() {
  const [standing, setStanding] = useState<'all' | Standing>('all');
  const [query, setQuery] = useState('');
  const [caveatOnly, setCaveatOnly] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const sections = useSections('/decisions', true);

  const reveal = useCallback((number: string) => {
    const record = BY_NUMBER.get(number);
    if (!record) return;

    setOpen((current) => new Set(current).add(number));
    // Each filter is cleared only if it is the one hiding the target, so a reader
    // who arrives by link keeps as much of their own view as still shows the row.
    setStanding((current) => (current === 'all' || current === record.standing ? current : 'all'));
    setCaveatOnly((current) => (current && record.caveats.length === 0 ? false : current));
    setQuery((current) =>
      current.trim() === '' || (TEXT.get(number) ?? '').includes(current.trim().toLowerCase())
        ? current
        : '',
    );
  }, []);

  // A reader can arrive on a row anchor from another page, or from a reload.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#rec-')) reveal(hash.slice('#rec-'.length));
  }, [reveal]);

  const toggle = (number: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(number)) next.add(number);
      return next;
    });

  const needle = query.trim().toLowerCase();
  const visible = RECORDS.filter((record) => {
    if (standing !== 'all' && record.standing !== standing) return false;
    if (caveatOnly && record.caveats.length === 0) return false;
    if (needle !== '' && !(TEXT.get(record.number) ?? '').includes(needle)) return false;
    return true;
  });
  const shown = new Set(visible.map((record) => record.number));

  return (
    <>
      <Slot id="contents">
        <Toc headings={sections} />
      </Slot>

      <Page className="text-m">
        <div className="flex min-w-0 flex-col gap-2xl">
          <header className="min-w-0">
            <p className="text-s uppercase tracking-wider text-on-canvas-muted">
              CORRECTIV community app · internal documentation
            </p>
            <h1 className="mt-2xs text-headline-xxl font-bold leading-tight tracking-tight">
              Decision records
            </h1>
            <p className="mt-s max-w-content text-l leading-normal text-on-canvas-muted">
              The choices this repository argued rather than assumed, and which of them still hold.
              A record says <em>why</em>;{' '}
              <a className={LINK} href={href('/architecture')}>
                the architecture
              </a>{' '}
              says what the thing is.
            </p>

            <div
              role="note"
              aria-label="How an expired claim is marked"
              className="mt-m max-w-content space-y-xs rounded-md border border-stroke border-l-2 border-l-accent bg-surface p-sm text-m text-on-canvas-muted"
            >
              <p>
                <strong className="font-semibold text-on-canvas">
                  A record is never rewritten to look right in hindsight.
                </strong>{' '}
                A claim a later decision made <em>false</em> is struck through where it stands, with
                one clause saying what voided it and a link to the record that did. The argument
                around it is left intact, because the reasoning is the part worth keeping.
              </p>
              <p>
                So <span className={FIGURE}>{STRUCK}</span> claims across these{' '}
                <span className={FIGURE}>{RECORDS.length}</span> records are struck, and a record
                carrying one still stands. That is the discipline working, not a fault, and it is
                the thing this board exists to make visible: it is invisible in the documents
                themselves unless you open all {RECORDS.length}.
              </p>
              <p>
                <span className={FIGURE}>{UNATTRIBUTED}</span> of those strikes name no later record
                in their clause. They were struck by a re-measurement, or by a later section of the
                same record, so they have no arrow to draw — each one&apos;s clause says which, and
                every clause is printed in the row&apos;s detail below.
              </p>
            </div>
          </header>

          {/*
            A heading beside the legend, not instead of it. The legend names the
            group for the browser; the heading is what puts this block in the
            outline. Both, for the same reason as on the sources board.
          */}
          <fieldset className="min-w-0" aria-labelledby="h-show">
            <legend className="sr-only">Show which records</legend>
            <h2 id="h-show" className={SECTION_HEAD}>
              Show
            </h2>
            <div className="mt-s grid gap-xs sm:grid-cols-2 xl:grid-cols-4">
              <Tile
                value="all"
                name="All records"
                count={COUNT.all}
                checked={standing === 'all'}
                onSelect={() => setStanding('all')}
              >
                Written between <span className={FIGURE}>{RECORDS[0].date}</span> and{' '}
                <span className={FIGURE}>{RECORDS[RECORDS.length - 1].date}</span>, in the order
                they were taken.
              </Tile>

              {ORDER.map((key) => (
                <Tile
                  key={key}
                  value={key}
                  name={STANDING_LOOK[key].label}
                  standing={key}
                  count={COUNT[key]}
                  checked={standing === key}
                  onSelect={() => setStanding(key)}
                >
                  {STANDING_LOOK[key].meaning}
                </Tile>
              ))}
            </div>
          </fieldset>

          <section className="min-w-0" aria-labelledby="h-careful">
            <h2 id="h-careful" className={SECTION_HEAD}>
              Read these with care
            </h2>
            <p className={SECTION_LEDE}>
              {CAREFUL.length} records where the record and the repository are not the same story:
              one whose own status line is struck through, and {CAREFUL.length - COUNT.withdrawn}{' '}
              that decided something the index says is not built, or not checked on every platform.
              Everything else on this board was carried out.
            </p>

            <ul className="mt-s grid gap-xs lg:grid-cols-3">
              {CAREFUL.map((record) => (
                <li
                  key={record.number}
                  className={cn(
                    'flex min-w-0 flex-col gap-xs rounded-md border border-stroke border-l-2 bg-surface p-sm',
                    record.standing === 'withdrawn'
                      ? 'border-l-accent'
                      : 'border-l-accent-alternative',
                  )}
                >
                  <p className="flex flex-wrap items-center gap-xs">
                    {record.standing === 'withdrawn' ? (
                      <StandingMark standing="withdrawn" />
                    ) : (
                      record.caveats.map((caveat) => <Caveat key={caveat} text={caveat} />)
                    )}
                    <span className={cn(FIGURE, 'font-semibold text-on-canvas')}>
                      {record.number}
                    </span>
                  </p>
                  <p className="font-medium text-on-canvas">{record.title}</p>
                  <p className="text-m text-on-canvas-muted">{record.note}</p>
                  <p className="mt-auto flex flex-wrap gap-sm pt-2xs text-m">
                    <a
                      className={LINK}
                      href={`#rec-${record.number}`}
                      onClick={() => reveal(record.number)}
                    >
                      Row
                    </a>
                    <a className={LINK} href={href(record.route)}>
                      Read the record
                    </a>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="min-w-0" aria-labelledby="h-board">
            <h2 id="h-board" className={SECTION_HEAD}>
              The board
            </h2>
            <p className={SECTION_LEDE}>
              One row per record, oldest first. A row expands to the index&apos;s sentence about it,
              every claim struck inside it with the clause that voided it, and both directions of
              the retirement graph. Nothing here is truncated. The tiles above filter the board as
              well.
            </p>

            <div className="mt-s flex flex-wrap items-end gap-sm rounded-md border border-stroke bg-surface p-s">
              <div className="min-w-0 flex-1 basis-[16rem]">
                <label
                  htmlFor="decisions-query"
                  className="mb-3xs block text-s font-medium text-on-canvas-muted"
                >
                  Filter records
                </label>
                <input
                  type="search"
                  id="decisions-query"
                  placeholder="number, title, or a claim"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-[2.25rem] w-full rounded-md border border-stroke bg-canvas px-xs text-m text-on-canvas placeholder:text-on-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <label className="flex items-center gap-xs text-m text-on-canvas-muted">
                <input
                  type="checkbox"
                  checked={caveatOnly}
                  onChange={(event) => setCaveatOnly(event.target.checked)}
                  className="size-[1rem] accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                Only what is not built or not checked
              </label>

              <div className="flex items-center gap-2xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(new Set(RECORDS.map((record) => record.number)))}
                >
                  Expand all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(new Set())}
                >
                  Collapse all
                </Button>
              </div>

              <output className="text-m tabular-nums text-on-canvas-muted">
                Showing {visible.length} of {RECORDS.length} records
              </output>
            </div>

            {/*
              The board scrolls inside this box, and two classes here are
              load-bearing for the same two reasons they are on the sources board:
              `min-w-0` or a flex child refuses to shrink below its content and the
              page scrolls sideways, and `relative` or the `sr-only` spans in the
              cells resolve against the page and reach out past the clip with
              nothing visible out there.
            */}
            <div className="relative mt-s min-w-0 overflow-x-auto rounded-md border border-stroke">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <caption className="border-b border-stroke bg-surface px-s py-xs text-left text-s text-on-canvas-muted">
                  Every architecture decision record in <code className="font-mono">adr/</code>,
                  with what has since been struck inside it.
                </caption>
                <thead>
                  <tr className="border-b border-stroke-strong">
                    {[
                      { head: 'Standing' },
                      { head: 'Record', width: 'w-[7rem]' },
                      { head: 'Decision' },
                      { head: 'Struck claims', width: 'w-[13rem]' },
                    ].map((column) => (
                      <th
                        key={column.head}
                        scope="col"
                        className={cn(
                          'px-s py-xs text-s font-semibold uppercase tracking-wider text-on-canvas-muted',
                          column.width,
                        )}
                      >
                        {column.head}
                      </th>
                    ))}
                    <th scope="col" className="px-s py-xs">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {RECORDS.map((record) => {
                    const isVisible = shown.has(record.number);
                    const isOpen = open.has(record.number);
                    return (
                      <Fragment key={record.number}>
                        <tr
                          id={`rec-${record.number}`}
                          hidden={!isVisible}
                          className={cn(
                            'align-top target:bg-surface',
                            isOpen ? 'bg-surface' : 'border-b border-stroke',
                          )}
                        >
                          <td
                            className={cn(
                              'border-l-2 px-s py-xs',
                              record.standing === 'withdrawn'
                                ? 'border-l-accent'
                                : record.caveats.length > 0
                                  ? 'border-l-accent-alternative'
                                  : 'border-l-transparent',
                            )}
                          >
                            <StandingMark standing={record.standing} />
                          </td>
                          <td className="px-s py-xs">
                            <span className={cn(FIGURE, 'block font-semibold text-on-canvas')}>
                              {record.number}
                            </span>
                            <span className={cn(FIGURE, 'block text-s text-on-canvas-muted')}>
                              {record.date}
                            </span>
                          </td>
                          <td className="min-w-0 px-s py-xs">
                            <a
                              className={cn(LINK, 'font-medium text-on-canvas')}
                              href={href(record.route)}
                            >
                              {record.title}
                            </a>
                            {(record.caveats.length > 0 || record.status !== 'accepted') && (
                              <span className="mt-3xs flex flex-wrap items-center gap-2xs">
                                {record.caveats.map((caveat) => (
                                  <Caveat key={caveat} text={caveat} />
                                ))}
                                {/* The status word only where it is not the usual
                                  one. Thirty rows reading "accepted" beside a chip
                                  that already says the record stands is a column
                                  of noise; three rows saying something else are
                                  the fact worth carrying. */}
                                {record.status !== 'accepted' && (
                                  <Badge variant="outline">{record.status}</Badge>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="px-s py-xs">
                            {record.struck.length === 0 ? (
                              <span className="text-on-canvas-muted">none</span>
                            ) : (
                              <>
                                <span className={cn(FIGURE, 'font-semibold text-on-canvas')}>
                                  {record.struck.length}
                                </span>
                                <span className="ml-3xs text-s text-on-canvas-muted">
                                  {record.struck.length === 1 ? 'claim' : 'claims'}
                                </span>
                                <span className="mt-3xs flex flex-wrap items-center gap-2xs">
                                  {record.voidedBy.length > 0 ? (
                                    <>
                                      <span className="text-s text-on-canvas-muted">by</span>
                                      {recordChips(record.voidedBy, reveal)}
                                    </>
                                  ) : (
                                    <span className="text-s text-on-canvas-muted">
                                      by no later record
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-s py-xs text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-expanded={isOpen}
                              aria-controls={`det-${record.number}`}
                              onClick={() => toggle(record.number)}
                            >
                              {isOpen ? 'Hide' : 'Details'}
                              {/* Thirty-three of these, and a reader listing the
                                page's controls heard "Details" thirty-three
                                times. The record is what tells them apart. */}
                              <span className="sr-only">
                                , ADR {record.number}, {record.title}
                              </span>
                            </Button>
                          </td>
                        </tr>
                        <tr
                          id={`det-${record.number}`}
                          hidden={!isVisible || !isOpen}
                          className="border-b border-stroke bg-surface"
                        >
                          <td colSpan={5} className="px-s pb-sm pt-0">
                            <div className="max-w-content space-y-sm text-m leading-normal text-on-canvas-muted">
                              <p>
                                <span className="text-on-canvas">The index says:</span>{' '}
                                {record.note}
                              </p>

                              {record.struck.length > 0 && (
                                <div>
                                  <p className="text-on-canvas">
                                    {record.struck.length === 1
                                      ? 'One claim is struck:'
                                      : `${record.struck.length} claims are struck:`}
                                  </p>
                                  <ul className="mt-2xs space-y-2xs">
                                    {/* Keyed by the claim AND its clause: the
                                      claim alone is not unique. ADR 0006 strikes
                                      the bare word `AsyncStorage` in two cells of
                                      one table, and React drew one of them and
                                      dropped the other. The two clauses differ,
                                      which is the only thing that tells the cells
                                      apart in the record either. */}
                                    {record.struck.map((claim) => (
                                      <li
                                        key={`${claim.claim}|${claim.clause}`}
                                        className="border-l-2 border-stroke-strong pl-s"
                                      >
                                        <s className="text-on-canvas-muted">{claim.claim}</s>
                                        {claim.clause !== '' && (
                                          <span className="block text-on-canvas">
                                            {claim.clause}
                                          </span>
                                        )}
                                        {claim.clause === '' && (
                                          /* A strike whose reason is in the
                                             following paragraph, which no parsing
                                             recovers. Said plainly rather than
                                             left as a claim with nothing after it,
                                             which reads as a parser that failed. */
                                          <span className="block text-s text-on-canvas-muted">
                                            No clause follows this strike. The record says why
                                            around it.
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {record.voids.length > 0 && (
                                <p className="flex flex-wrap items-center gap-2xs">
                                  <span className="text-on-canvas">
                                    It struck {record.voids.length === 1 ? 'a claim' : 'claims'} in
                                  </span>
                                  {recordChips(record.voids, reveal)}
                                </p>
                              )}

                              <p>
                                <a className={LINK} href={href(record.route)}>
                                  Read ADR {record.number}
                                </a>
                              </p>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="min-w-0 space-y-xs border-t border-stroke pt-sm text-m text-on-canvas-muted">
            <p className="max-w-content">
              Every row, count and edge above is read out of the records themselves at build time.
              The handbook holds no copy of any of them, so this board cannot disagree with{' '}
              <code className="font-mono">adr/</code> — and when it cannot read one, the site does
              not build.
            </p>
            <p className="max-w-content">
              The index those sentences come from is published whole at{' '}
              <a className={LINK} href={href('/decisions-notes')}>
                Decisions, the notes
              </a>
              , which carries the part a table of rows cannot: the notes for readers of the older
              records, and the rule above in full.
            </p>
          </footer>
        </div>
      </Page>
    </>
  );
}
