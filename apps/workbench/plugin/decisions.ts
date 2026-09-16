import type { RenderedDoc, RetiredClaim } from './markdown.ts';
import { adrNumber, adrRoute } from './registry.ts';

/**
 * What the decisions board knows about one record, derived, never typed.
 *
 * `adr/README.md` is the index and every `adr/0NNN-*.md` is a record, and both
 * are read in place: the workbench holds no copy of either. Everything below comes
 * out of those files at build time, so the board cannot disagree with the records
 * it lists. When it cannot read one, `buildDecisions` throws and the site does not
 * build — a page that silently listed thirty-three records with no dates and no
 * strikes would look exactly like a working one.
 */
export interface DecisionRecord {
  /** `0022`, zero-padded, which is also the sort key and the anchor. */
  number: string;
  route: string;
  /** The h1 with its `ADR 0022 — ` prefix removed; the number has its own column. */
  title: string;
  /** The day the decision was taken, out of the record's own status line. */
  date: string;
  /** What that line calls it: `accepted`, `gate passed`, `decided, being implemented`. */
  status: string;
  standing: Standing;
  /** The index's sentence about this record, as plain text. */
  note: string;
  /**
   * What the index says this record has not carried out: `iOS unrun`, `not built`.
   *
   * A different kind of fact from the status, and it needs its own treatment
   * rather than a second pill: `accepted` is a decision about what to do, and
   * `not built` is a fact about the world that the decision does not change.
   */
  caveats: string[];
  /** Every claim in this record that a later one, or a re-measurement, made false. */
  struck: RetiredClaim[];
  /** Records that struck a claim in this one, ascending. */
  voidedBy: string[];
  /** Records in which this one struck a claim, ascending. The inverse of the above. */
  voids: string[];
}

/**
 * Whether the record still holds, which is the question the board exists to answer.
 *
 * Three states and no more. `partly-struck` is the ordinary healthy state of this
 * repository and covers most of the set: a record is never rewritten to look right
 * in hindsight, so a claim that has become false is struck where it stands and the
 * argument around it is left intact. Only `withdrawn` means "do not act on this".
 */
export type Standing = 'stands' | 'partly-struck' | 'withdrawn';

/**
 * One record striking claims in an earlier one, as an edge rather than as two
 * lists.
 *
 * `voidedBy` and `voids` are the same relation read from its two ends, which is
 * what a table row wants: the board prints "struck by 0009, 0015" beside one
 * record. A drawing wants the relation itself, once, with its weight — an arc is
 * drawn between two rungs and has to know how heavy it is. Deriving that in the
 * drawing would be a second reading of the retirement graph outside this file,
 * and the second reading is the one that goes wrong quietly.
 *
 * The weight is a real distinction and not decoration: 0024 struck six claims in
 * 0014 and 0034 struck one in 0013, and an arc that drew those the same would say
 * the two records were amended alike.
 */
export interface Strike {
  /** The later record, which did the striking. */
  by: string;
  /** The earlier record, whose claims stopped being true. */
  of: string;
  /** How many of `of`'s struck claims name `by` in their clause. At least one. */
  claims: number;
}

/**
 * Every strike between two records, in drawing order: by the record struck, then
 * by the record that struck it.
 *
 * Exactly the edges `voidedBy` already names — a number is in `voidedBy` because
 * at least one clause cites it, so no edge here can come out at zero — with the
 * count that neither list carries. `test/diagrams.test.ts` holds the drawing's
 * arcs to this, and this to `voidedBy`, so the picture cannot grow an arc the
 * records do not state.
 */
export function strikeEdges(records: DecisionRecord[]): Strike[] {
  const edges: Strike[] = [];
  for (const record of records) {
    for (const by of record.voidedBy) {
      edges.push({
        by,
        of: record.number,
        claims: record.struck.filter((claim) => claim.by.includes(by)).length,
      });
    }
  }
  return edges;
}

/** Where the index lives, and the one document that is not itself a record. */
const INDEX_FILE = 'adr/README.md';

/**
 * One row of the index table: the number, and the sentence in its last column.
 *
 * Matched on the raw Markdown rather than on the rendered HTML, because a cell
 * that is already a string of tags and entities has to be unpicked again before
 * anything can be read out of it. Anchored on a link whose text is the record
 * number, which is what the first column of that table is.
 */
const INDEX_ROW = /^\|\s*\[(0\d{3})\]\([^)]*\)\s*\|[^|]*\|([^|]*)\|/;

/**
 * The four words the index uses for "decided, and not carried out or not checked".
 *
 * A closed list rather than a parser, because there is no grammar to this: the
 * index says `iOS unrun`, `not built`, `unopened in a browser`, `simulated
 * sign-in`, and a caveat is the clause one of these stands in. Taking the bold
 * spans instead was tried first and read the set wrongly — ADR 0030 bolds
 * `iOS unrun` and ADR 0013 does not, and both records mean it.
 *
 * Exported so `test/decisions.test.ts` asks the same question this file answers,
 * rather than typing a second copy of the list and agreeing with itself.
 */
export const CAVEAT_MARKERS = /\b(not built|unrun|unopened|simulated)\b/i;

/** `**Status:** accepted · …` and `Status: accepted, 2026-08-27. …` are both this. */
const STATUS_HEAD = /^\*{0,2}Status:\*{0,2}:?\s*/;

const ISO_DATE = /\d{4}-\d{2}-\d{2}/;

/**
 * Every record, with its standing and its half of the retirement graph.
 *
 * `docs` is every document the site publishes; the records are picked out of it by
 * filename so that writing a record is all it takes to appear here, and `sources`
 * hands over the Markdown they were rendered from, because neither the status line
 * nor the index's table survives as anything readable once it is HTML.
 */
export function buildDecisions(
  docs: RenderedDoc[],
  sources: ReadonlyMap<string, string>,
): DecisionRecord[] {
  const index = sources.get(INDEX_FILE);
  if (index === undefined) throw new Error(`${INDEX_FILE} is not among the collected documents.`);
  const notes = indexNotes(index);

  const records = docs
    .filter((doc) => adrNumber(doc.file) !== null)
    .map((doc) => {
      const number = adrNumber(doc.file) as string;
      const markdown = sources.get(doc.file);
      if (markdown === undefined) throw new Error(`ADR ${number} was rendered from nothing.`);
      const note = notes.get(number);
      if (note === undefined) {
        throw new Error(`ADR ${number} has no row in ${INDEX_FILE}. Add one, or the board lies.`);
      }
      const { status, struck, date } = readStatus(number, markdown);

      return {
        number,
        route: adrRoute(number),
        title: doc.title.replace(/^ADR\s*0\d{3}\s*[—–-]\s*/, ''),
        date,
        status,
        standing: standingOf(struck, doc.retired.length),
        note: plain(note),
        caveats: caveatsIn(note),
        struck: doc.retired,
        voidedBy: voidersOf(number, doc.retired),
        voids: [],
      } satisfies DecisionRecord;
    })
    .sort((a, b) => a.number.localeCompare(b.number));

  // The other direction, which is the same edges read from the other end. Derived
  // rather than parsed a second time, so the two halves cannot disagree.
  const numbers = new Set(records.map((record) => record.number));
  for (const record of records) {
    for (const voider of record.voidedBy) {
      if (numbers.has(voider)) {
        (records.find((r) => r.number === voider) as DecisionRecord).voids.push(record.number);
      }
    }
  }
  for (const record of records) record.voids.sort();

  guard(records, sources);
  return records;
}

/**
 * Whether the record still holds.
 *
 * The status line's own strike is what says a record no longer stands, and it is
 * the record-level signal rather than a claim-level one: ADR 0002 is the only
 * record whose `Status:` is struck through, and its decision line is struck
 * beneath it. A struck claim is not bad news and does not demote a record — it is
 * the discipline working, which is why most of the set carries one.
 */
function standingOf(statusStruck: boolean, claims: number): Standing {
  if (statusStruck) return 'withdrawn';
  return claims > 0 ? 'partly-struck' : 'stands';
}

/**
 * The clauses of an index note that say something has not been built or checked.
 *
 * Split on the punctuation the notes are written with, so the caveat is the
 * fragment and not the sentence: "accepted; verified on Android, iOS unrun"
 * yields "iOS unrun" and not the verification beside it.
 */
function caveatsIn(note: string): string[] {
  return note
    .split(/[;,]/)
    .map((part) => plain(part))
    .filter((part) => CAVEAT_MARKERS.test(part));
}

/**
 * The records that struck a claim in this one, out of the clauses that void them.
 *
 * `RetiredClaim.by` is every record number the voiding clause names, and a clause
 * names a record for more than one reason. ADR 0026 strikes its own "Nothing in
 * another ADR." with the clause "Two cells in ADR 0006's ports table, struck there
 * when section 4 was carried out" — 0006 is where 0026 did the striking, not the
 * record that struck 0026.
 *
 * The rule that separates the two needs no vocabulary of voiding verbs, because it
 * is true by construction: **a record can only be made false by a later one.** A
 * citation of an earlier number is a reference, not an edge.
 */
function voidersOf(number: string, claims: RetiredClaim[]): string[] {
  const cited = new Set(claims.flatMap((claim) => claim.by).filter((by) => by > number));
  return [...cited].sort();
}

/**
 * The record's own status line: what it is, when it was taken, and whether the
 * status itself has been struck through.
 *
 * Two spellings are in the tree and both are here: the first four records and two
 * later ones write `**Status:** accepted · **Date:** 2026-08-01 · **Affects:** …`,
 * and the rest write `Status: accepted, 2026-08-27.` followed by prose. So the
 * status word is whatever stands before the first ` · ` or before the date, and the
 * date is the first ISO date anywhere in the block — which for ADR 0023, "accepted,
 * 2026-08-27. Recorded 2026-09-04, after the fact.", is correctly the day the
 * decision was taken rather than the day somebody wrote it down.
 */
function readStatus(
  number: string,
  markdown: string,
): { status: string; struck: boolean; date: string } {
  const block = markdown
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => STATUS_HEAD.test(part));
  if (!block) throw new Error(`ADR ${number} has no status line.`);

  const flat = block.replace(/\s*\n\s*/g, ' ').replace(STATUS_HEAD, '');
  const head = flat
    .split(' · ')[0]
    .split(/,\s*(?=\d{4}-\d{2}-\d{2})/)[0]
    .split(/\.\s/)[0]
    .trim();

  const struck = head.startsWith('~~');
  const status = plain(head).replace(/[.,;:]$/, '');
  const date = ISO_DATE.exec(block)?.[0];
  if (status === '') throw new Error(`ADR ${number}'s status line names no status.`);
  if (!date) throw new Error(`ADR ${number}'s status line carries no date.`);

  return { status, struck, date };
}

/** The last column of the index table, by record number, still in Markdown. */
function indexNotes(markdown: string): Map<string, string> {
  const notes = new Map<string, string>();
  for (const line of markdown.split('\n')) {
    const row = INDEX_ROW.exec(line.trim());
    if (row) notes.set(row[1], row[2].trim());
  }
  return notes;
}

/**
 * Records carrying a strike whose clause this file cannot reach, and why each one.
 *
 * A ratchet, so it is a debt and not a state (ADR 0031): asserted in BOTH
 * directions, so another record written this way fails the build, and so does
 * fixing one of these without shortening the list.
 *
 * Two shapes put a reason out of reach. Both read perfectly in the record, and
 * both are invisible to the collector, which takes a clause to be the run of
 * inline tokens between one strike and the next IN THE SAME BLOCK:
 *
 *   THE REASON IS THE NEXT BLOCK. ADR 0022's miscount is struck as a whole
 *   paragraph and the blockquote under it says "Struck on 2026-09-04: it was a
 *   miscount on the day". ADR 0019 strikes one bullet and writes "Both void with
 *   …" at the end of the bullet after it. Nothing joins a block to the one that
 *   follows it, and nothing should: a clause that ran on into the next paragraph
 *   would attach half the document to every strike at the end of one.
 *
 *   TWO STRIKES SHARE ONE CLAUSE. ADR 0006 strikes `AsyncStorage + a hydrated
 *   mirror` and then `AsyncStorage`, one after the other in a table cell, and
 *   "MMKV, in a store of its own, since 0026" belongs to the second. ADR 0018 and
 *   ADR 0027 do the same and finish with "Both are gone with …" and "Both voided
 *   by ADR 0028". The first strike of each pair is left with nothing after it.
 *
 * The board says so where these rows are drawn, rather than printing a struck
 * claim with silence under it, which reads as a parser that failed.
 *
 * ADR 0002 was a sixth, in both shapes at once, and was fixed rather than listed:
 * its status line's strike was followed only by `**Date:**` and `**Affects:**`
 * while the clause that voided it sat in a blockquote below, so the board read the
 * one record a later record overturned as voided by nobody. The fix is the shape
 * this list is asking for — the clause stands with the strike, in its block.
 */
const CLAUSE_IS_ELSEWHERE = ['0006', '0018', '0019', '0022', '0027'];

/**
 * Records whose index row reports a status their own status line does not use.
 *
 * The other ratchet, and the other half of a finding that lived in a pull request
 * description and in nothing else. `adr/README.md` opens ADR 0003's row with
 * `accepted` where the record says `gate passed`, and ADR 0004's with `accepted`
 * where the record says `decided, being implemented`. Neither is a parser fault
 * and neither is harmless: the index is what a reader scans, and `decided, being
 * implemented` is a different thing to act on from `accepted`.
 *
 * Withdrawn records are not compared at all. ADR 0002's row opens `moot since
 * 0007`, which is a sentence about the retirement rather than about the status,
 * and that is the right thing for it to say.
 */
const INDEX_DISAGREES = ['0003', '0004'];

/** The word an index row opens with, which is where it states a status. */
function indexStatus(note: string): string {
  return note.split(/[;,.]/)[0].trim();
}

/**
 * What must be true of the result, asserted where it is built rather than only in
 * a test.
 *
 * Every one of these is a way for this file to go quietly empty: a table that
 * stops being a table, a strike syntax that changes, a citation regex that matches
 * nothing. The page would still render, with thirty-four rows, no dates and every
 * record standing — which is the most confident wrong answer this site could give
 * about the one thing it is for. An exception here is the strongest mechanism
 * available to a build-time module (ADR 0031): the site does not build.
 *
 * THE FLOORS ARE PROPORTIONAL, and they were not. Each of the three collectors was
 * guarded by "at least one record has one", against a set where eighteen of
 * thirty-four carry a strike — so a collector degraded to finding a single strike,
 * or a single voider, satisfied the guard, and the board printed a confident wrong
 * answer about how much of this repository's reasoning has expired. That is the
 * exact failure this comment warns about, passed by its own guard. A fraction of
 * the set is not a number anybody has to maintain, and it fails while the page is
 * still merely wrong rather than a lie.
 */
function guard(records: DecisionRecord[], sources: ReadonlyMap<string, string>): void {
  const faults: string[] = [];

  /*
   * Every record file that was read has to have become a record. This replaces
   * `records.length < 20` against thirty-four, which left fourteen records' worth
   * of slack in the one number that says whether the board is complete: the count
   * is exact now, and the floor underneath it is only there so that two empties
   * cannot agree with each other.
   */
  const files = [...sources.keys()].filter((file) => /^adr\/0\d{3}-.*\.md$/.test(file));
  if (records.length !== files.length) {
    faults.push(`${files.length} record files were read and ${records.length} became records`);
  }
  // Thirty-four today. A record is never deleted, so this only ever rises and
  // never needs raising.
  if (files.length < 34) faults.push(`only ${files.length} record files were read`);

  const struck = records.filter((record) => record.struck.length > 0).length;
  const voided = records.filter((record) => record.voidedBy.length > 0).length;
  const withCaveat = records.filter((record) => record.caveats.length > 0).length;

  // Eighteen of thirty-four carry a strike, eleven name a voider, five carry a
  // caveat. A quarter, an eighth and a tenth of the set puts the three thresholds
  // at eight, four and three, so each may fall by roughly half before it fires and
  // none of them can be satisfied by one record, which is what they were.
  if (struck < records.length / 4) {
    faults.push(`only ${struck} of ${records.length} records carry a struck claim`);
  }
  if (voided < records.length / 8) {
    faults.push(`only ${voided} of ${records.length} records name a record that voided a claim`);
  }
  if (withCaveat < records.length / 10) {
    faults.push(`only ${withCaveat} of ${records.length} index rows name something unbuilt`);
  }
  if (records.some((record) => record.note === '')) {
    faults.push('an index row has an empty note column');
  }

  const clauseless = records
    .filter((record) => record.struck.some((claim) => claim.clause === ''))
    .map((record) => record.number);
  const unexpected = clauseless.filter((number) => !CLAUSE_IS_ELSEWHERE.includes(number));
  const fixed = CLAUSE_IS_ELSEWHERE.filter((number) => !clauseless.includes(number));
  if (unexpected.length > 0) {
    faults.push(
      `ADR ${unexpected.join(', ')} strikes a claim with no clause after it. Put the clause in the same paragraph as the strike, or add the number to CLAUSE_IS_ELSEWHERE with its reason`,
    );
  }
  if (fixed.length > 0) {
    faults.push(`ADR ${fixed.join(', ')} no longer needs CLAUSE_IS_ELSEWHERE; take it out`);
  }

  const disagreeing = records
    .filter((record) => record.standing !== 'withdrawn')
    .filter((record) => {
      const stated = indexStatus(record.note).toLowerCase();
      const own = record.status.toLowerCase();
      return !stated.includes(own) && !own.includes(stated);
    })
    .map((record) => record.number);
  const newlyDisagreeing = disagreeing.filter((number) => !INDEX_DISAGREES.includes(number));
  const agreed = INDEX_DISAGREES.filter((number) => !disagreeing.includes(number));
  if (newlyDisagreeing.length > 0) {
    faults.push(
      `ADR ${newlyDisagreeing.join(', ')} states a status its row in ${INDEX_FILE} does not. Fix one of the two, or add the number to INDEX_DISAGREES with its reason`,
    );
  }
  if (agreed.length > 0) {
    faults.push(
      `ADR ${agreed.join(', ')} agrees with its index row now; take it out of INDEX_DISAGREES`,
    );
  }

  if (faults.length > 0) {
    throw new Error(`The decisions board read the records wrongly: ${faults.join('; ')}.`);
  }
}

/** Markdown emphasis, code ticks and link syntax removed; the words kept. */
function plain(markdown: string): string {
  return markdown
    .replace(/~~/g, '')
    .replace(/\*\*?/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
