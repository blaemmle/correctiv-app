import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { adrFiles, collectDocs, ROOT } from '../plugin/collect';
import { decisionNumber } from '../plugin/markdown';
import { adrNumber } from '../plugin/registry';

/**
 * The numbers inside the records, and the one property that makes them worth
 * writing: that `ADR 0026 §6` still points at the same decision in a year.
 *
 * Everything else here is bookkeeping. `adr/decisions.lock.json` is the ledger —
 * every text each number has ever carried, oldest first — and it is the only thing
 * in this file that can catch a renumbering, because a renumbering leaves a record
 * that is internally perfectly consistent. The rule it enforces is append-only: a
 * number is never reused, never moved to another decision, and a decision that is
 * removed leaves its number behind as a gap.
 *
 * An entry is a LIST and the record carries its own slug, and both of those are
 * answers to a cold review on 2026-09-16 that broke the first version three ways.
 * It deleted a record and wrote a different one under the same number: every check
 * was green, because nothing held a number to a document. It moved a decision from
 * one record to another: green after one `npm run adr:lock`, because the tool's
 * refusal only compared a number against its own record. And it swapped two
 * numbers and then made the hand-edit the failure message asked for: green, because
 * a ledger that stores only the current text cannot tell a swap from two rewords.
 * The history is what makes that last one visible — after the swap the same text
 * stands in two numbers' pasts, which no honest sequence of edits produces.
 *
 * This is ADR 0031's mechanism 4, reading the source, and it is where this has to
 * sit. Mechanism 1 wants a closed set TypeScript can see and the set here is
 * Markdown headings; mechanism 2 wants a generator whose output can be rebuilt
 * from the world, and rebuilding this ledger wholesale is exactly the operation
 * that would accept a renumbering in silence. Being regenerable is the property it
 * must not have.
 */

interface Decision {
  record: string;
  file: string;
  depth: number;
  number: number;
  text: string;
}

interface LedgerEntry {
  /** The record's own identity: `0029-the-handbook-keeps-its-own-primitives.md` gives the tail. */
  slug: string;
  /** Number to every text it has ever carried, oldest first. */
  decisions: Record<string, string[]>;
}

type Ledger = Record<string, LedgerEntry>;

const LEDGER_PATH = 'adr/decisions.lock.json';
const ledger = JSON.parse(readFileSync(join(ROOT, LEDGER_PATH), 'utf8')) as Ledger;

/**
 * Every numbered heading in every record, as written.
 *
 * Read from the Markdown rather than from the rendered documents, so a heading at
 * a level the site does not put in its contents list is still seen. `##` and `###`
 * are the two the numbering uses; anything deeper is asserted against below rather
 * than filtered out here, because a numbered `####` is the mistake worth naming.
 */
function decisions(): Decision[] {
  const found: Decision[] = [];
  for (const file of adrFiles()) {
    const record = adrNumber(file) as string;
    for (const line of readFileSync(join(ROOT, file), 'utf8').split('\n')) {
      const hit = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!hit) continue;
      const number = decisionNumber(hit[2]);
      if (number === null) continue;
      // The heading as written, backticks and all. `adr.mjs` stores the same
      // string, and the two parsers being separate is what makes a disagreement
      // between them a red test rather than a quiet difference.
      found.push({
        record,
        file,
        depth: hit[1].length,
        number,
        text: hit[2].replace(/^\d{1,3}\.\s+/, '').trim(),
      });
    }
  }
  return found;
}

const all = decisions();
const byRecord = new Map<string, Decision[]>();
for (const decision of all) {
  const list = byRecord.get(decision.record) ?? [];
  list.push(decision);
  byRecord.set(decision.record, list);
}

describe('the records', () => {
  it('gives no two records the same number', () => {
    // The check that was missing on 2026-09-16, when two records both claimed
    // 0034. The filenames differed by their slug, so there was no merge conflict
    // and nothing was red; the duplicate was found by somebody happening to look.
    const seen = new Map<string, string[]>();
    for (const file of readdirSync(join(ROOT, 'adr'))) {
      const number = adrNumber(file);
      if (number === null) continue;
      seen.set(number, [...(seen.get(number) ?? []), file]);
    }
    const shared = [...seen]
      .filter(([, files]) => files.length > 1)
      .map(([number, files]) => `${number}: ${files.join(' and ')}`);
    expect(shared).toEqual([]);
  });

  it('says how many there are, and is right about it', () => {
    // A count typed in a document goes wrong quietly: this sentence said
    // twenty-nine while the directory held thirty-three. `npm run adr:new` is
    // where the number comes from when a record is added.
    const claimed = /^([A-Z][a-z]+(?:-[a-z]+)?) records shaped this repo/m.exec(readme())?.[1];
    expect(claimed).toBe(inWords(adrFiles().length));
  });

  it('says how many notes follow it, and is right about that too', () => {
    // The second typed count in the same document, and it was already wrong: it
    // said nine over eight notes, and had said so long enough that nobody knows
    // which note left. Counted here rather than corrected once, because the
    // correction is the part that does not last.
    const text = readme();
    const claimed = /^([A-Z][a-z]+(?:-[a-z]+)?) notes for readers/m.exec(text)?.[1];
    // Bounded to the list, not to the rest of the file: `adr/README.md` has prose
    // after it and a bulleted list added down there would inflate this and redden
    // the test for a reason that has nothing to do with the notes. The list ends
    // at the first line that is neither a bullet, a bullet's continuation, nor
    // blank.
    const after = text.slice(text.indexOf('notes for readers')).split('\n').slice(1);
    let notes = 0;
    for (const line of after) {
      if (line.startsWith('- ')) notes++;
      else if (line.trim() !== '' && !/^\s/.test(line)) break;
    }
    expect(claimed).toBe(inWords(notes));
  });
});

/** The spellings `inWords` produces, lowercased, so the check below reads numbers only. */
const NUMBER_WORDS = Array.from({ length: 40 }, (_, i) => inWords(i + 1).toLowerCase());

describe("the index's own arithmetic", () => {
  it('lists every record exactly once, and lists nothing else', () => {
    // Deleting a row was invisible: nothing tied the table to the directory, and
    // it had already drifted once — commit 407bd59 is "List ADR 0033 in the
    // index", written after the record was.
    const listed = [...readme().matchAll(/^\| \[(0\d{3})\]\(([^)]+)\)/gm)];
    const rows = listed.map((hit) => hit[1]);
    const files = adrFiles().map((file) => adrNumber(file) as string);
    expect(rows).toEqual([...files].sort());
    // And each row's link has to reach the file it claims, or the table is right
    // about the set and wrong about every address in it.
    const wrong = listed
      .map((hit) => ({ number: hit[1], href: hit[2] }))
      .filter(
        ({ number, href }) =>
          !adrFiles().some((file) => file === `adr/${href}` && adrNumber(file) === number),
      );
    expect(wrong).toEqual([]);
  });

  it('is right when a row says how many decisions a record makes', () => {
    // `0026` reads "nine decisions". It was nine when it was typed and nothing
    // read it. The ledger knows the number now, so the phrase is checkable
    // wherever anybody writes it.
    const wrong: string[] = [];
    for (const line of readme().split('\n')) {
      const row = /^\| \[(0\d{3})\]/.exec(line);
      // Only a spelled number, or "its decision" and "the record's decision"
      // both read as counts and the check fails on English rather than on a
      // figure.
      const said = new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\s+decisions?\\b`).exec(line);
      if (!row || !said) continue;
      const held = Object.keys(ledger[row[1]]?.decisions ?? {}).length;
      const inWordsLower = inWords(held).toLowerCase();
      if (said[1] !== inWordsLower) {
        wrong.push(`ADR ${row[1]}: the row says ${said[1]}, the ledger holds ${inWordsLower}`);
      }
    }
    expect(report('A row counts a record\u2019s decisions and gets it wrong.', wrong)).toBe('');
  });
});

describe('the decisions inside them', () => {
  it('gives every record at least one numbered decision', () => {
    // A decision with no number cannot be cited, which is the whole point. This
    // fails for a record whose decision section nobody numbered.
    const silent = adrFiles()
      .map((file) => adrNumber(file) as string)
      .filter((record) => !byRecord.has(record));
    expect(silent).toEqual([]);
  });

  it('uses each number once within a record', () => {
    const doubled: string[] = [];
    for (const [record, list] of byRecord) {
      const counts = new Map<number, number>();
      for (const d of list) counts.set(d.number, (counts.get(d.number) ?? 0) + 1);
      for (const [number, count] of counts) {
        if (count > 1) doubled.push(`${record} §${number} appears ${count} times`);
      }
    }
    expect(doubled).toEqual([]);
  });

  it('numbers a section heading and never a detail inside one', () => {
    // `##` is a record's own decision block; `###` is one decision inside it. A
    // numbered `####` would be a number on a paragraph, and the number would stop
    // meaning "a decision this record makes".
    const wrong = all.filter((d) => d.depth !== 2 && d.depth !== 3);
    expect(wrong.map((d) => `${d.file}: ${'#'.repeat(d.depth)} ${d.number}. ${d.text}`)).toEqual(
      [],
    );
  });
});

describe('the ledger', () => {
  /** The texts a number has carried, oldest first. */
  const historyOf = (record: string, number: number): string[] | undefined =>
    ledger[record]?.decisions?.[String(number)];

  it('holds every number that has ever been used', () => {
    const missing = all
      .filter((d) => historyOf(d.record, d.number) === undefined)
      .map((d) => `${d.record} §${d.number} (${d.text})`);
    expect(report(`Not in ${LEDGER_PATH}. Run \`npm run adr:lock\`.`, missing)).toBe('');
  });

  it('points every record number at the document it has always pointed at', () => {
    // The hole a cold review walked through on 2026-09-16: it deleted ADR 0029
    // and wrote an unrelated record under the same number. Every other check
    // here passed, because they all read the decisions inside a record and
    // nothing read which record it was. Every `ADR 0029` in the repository then
    // pointed somewhere else, silently.
    const moved = adrFiles()
      .map((file) => ({ record: adrNumber(file) as string, slug: slugOf(file) }))
      .filter(({ record, slug }) => ledger[record] !== undefined && ledger[record].slug !== slug)
      .map(
        ({ record, slug }) => `ADR ${record}\n    was: ${ledger[record].slug}\n    now: ${slug}`,
      );
    expect(
      report(
        'A record number names a different document than it used to. Renaming the file is ' +
          'fine and the slug is edited in the same commit; reusing the number for another ' +
          'record is not, because every citation of it now points at the wrong record.',
        moved,
      ),
    ).toBe('');
  });

  it('still finds each number naming the decision it names today', () => {
    // The assertion this file exists for. A reordering, a renumbering after an
    // insertion, or a number quietly reused for something else all land here, and
    // all three leave the record itself looking perfectly consistent.
    const moved: string[] = [];
    for (const decision of all) {
      const history = historyOf(decision.record, decision.number);
      if (history !== undefined && history.at(-1) !== decision.text) {
        moved.push(
          `ADR ${decision.record} §${decision.number}\n    was: ${history.at(-1)}\n    now: ${decision.text}`,
        );
      }
    }
    expect(
      report(
        'A number in use names something else now. If the heading was only reworded, ' +
          '`npm run adr:lock` appends it. If the number moved to another decision, move it ' +
          'back: the numbers are append-only, and they are cited across the repository, in ' +
          'code comments, in tests and in other records.',
        moved,
      ),
    ).toBe('');
  });

  it('never has one text standing in two numbers of the same record', () => {
    // The third hole from the same review, and the subtlest. It swapped two
    // numbers and then made the hand-edit the old failure message asked for, and
    // everything went green: a ledger that stores only the current text cannot
    // tell a swap from two rewords. Keeping the history makes the swap visible
    // from its shape — afterwards the same text stands in both numbers' pasts,
    // which no honest sequence of rewords produces.
    const collisions: string[] = [];
    for (const [record, entry] of Object.entries(ledger)) {
      const where = new Map<string, string>();
      for (const [number, history] of Object.entries(entry.decisions ?? {})) {
        for (const text of history) {
          const already = where.get(text);
          if (already !== undefined && already !== number) {
            collisions.push(`ADR ${record} §${already} and §${number} have both held\n    ${text}`);
          }
          where.set(text, number);
        }
      }
    }
    expect(report('Two numbers of one record have carried the same text.', collisions)).toBe('');
  });

  it('never lets a distinctive decision reappear under another record', () => {
    // A decision lifted out of one record and pasted into another: the first
    // leaves a gap, which is allowed, and the second is simply a number the
    // ledger has not seen, which is also allowed. Only the text ties them.
    //
    // It can only be as strict as the text is distinctive, and most are not: the
    // records that state one unsectioned decision all have a §1 reading
    // "Decision". A text held in more than one place says nothing about a move,
    // so only a text held in exactly one place is guarded. That limit is the
    // reason a record with several decisions should title them.
    const places = new Map<string, string[]>();
    for (const [record, entry] of Object.entries(ledger)) {
      for (const [number, history] of Object.entries(entry.decisions ?? {})) {
        for (const text of history) {
          places.set(text, [...(places.get(text) ?? []), `${record} §${number}`]);
        }
      }
    }
    const lifted: string[] = [];
    for (const decision of all) {
      if (historyOf(decision.record, decision.number) !== undefined) continue;
      const home = places.get(decision.text);
      if (home?.length === 1 && !home[0].startsWith(decision.record)) {
        lifted.push(
          `ADR ${decision.record} §${decision.number} takes the text of ${home[0]}\n    ${decision.text}`,
        );
      }
    }
    expect(report('A decision appears under a number it did not have.', lifted)).toBe('');
  });

  it('never lets a retired number be handed to a new decision', () => {
    // A decision that is removed leaves a gap. The gap is what stops §3 of a
    // record meaning one thing in the citations written last year and another in
    // the ones written this year, so a new decision has to take a number above
    // every number the ledger has ever recorded for that record.
    const reused: string[] = [];
    for (const [record, list] of byRecord) {
      const held = Object.keys(ledger[record]?.decisions ?? {}).map(Number);
      const highest = held.length > 0 ? Math.max(...held) : 0;
      for (const decision of list) {
        const known = historyOf(record, decision.number) !== undefined;
        if (!known && decision.number <= highest) {
          reused.push(
            `ADR ${record} §${decision.number} (${decision.text}) — free numbers start at ${highest + 1}`,
          );
        }
      }
    }
    expect(reused).toEqual([]);
  });
});

describe('the citations', () => {
  /**
   * `§` had no fixed meaning in this repository until the numbers existed, and
   * the day it got one, two sentences written before it became ambiguous: ADR
   * 0003 said "the gate set in §8" about `APP-STRATEGIE.md` while acquiring a §1
   * of its own, and ADR 0028 said "decision 12 of the redesign" two lines after a
   * correct `§6`.
   *
   * So: a `§` is a decision in a record, and a section of some other document
   * says which document. A bare `§N` inside a record means that record's own §N.
   */
  const everyMarkdown = (): { file: string; text: string }[] =>
    adrFiles().map((file) => ({ file, text: readFileSync(join(ROOT, file), 'utf8') }));

  it('points every `ADR NNNN §M` at a decision that exists', () => {
    const dangling: string[] = [];
    for (const { file, text } of [...everyMarkdown(), { file: 'adr/README.md', text: readme() }]) {
      for (const hit of text.matchAll(/ADR (0\d{3})[^§\n]{0,80}§(\d{1,3})/g)) {
        if (ledger[hit[1]]?.decisions?.[hit[2]] === undefined) {
          dangling.push(`${file}: ADR ${hit[1]} §${hit[2]}`);
        }
      }
    }
    expect(report('A citation names a decision the ledger does not hold.', dangling)).toBe('');
  });

  it('points every bare `§M` inside a record at that record\u2019s own decision', () => {
    const dangling: string[] = [];
    for (const { file, text } of everyMarkdown()) {
      const record = adrNumber(file) as string;
      for (const line of text.split('\n')) {
        for (const hit of line.matchAll(/§(\d{1,3})/g)) {
          // A `§` that already names its document, or names a record, is the
          // other check's business.
          const before = line.slice(0, hit.index);
          if (/(ADR \d{4}|`[^`]+\.md`|\.md\))[^§]{0,80}$/.test(before)) continue;
          if (ledger[record]?.decisions?.[hit[1]] === undefined) {
            dangling.push(`${file}: a bare §${hit[1]}, and ADR ${record} has no such decision`);
          }
        }
      }
    }
    expect(
      report(
        'A bare section mark reads as this record\u2019s own decision. If it means a section ' +
          'of another document, name the document beside it.',
        dangling,
      ),
    ).toBe('');
  });
});

describe('the anchors', () => {
  const docs = collectDocs().module.docs;

  it('answers /decisions/<record>#<number> for every decision', () => {
    // `#6`, not `#6-german-and-english-from-the-first-string`. A slug is derived
    // from the words, so it dies on the reword the number was introduced to
    // survive. This is the assertion that the handbook mints the number instead.
    const unreachable: string[] = [];
    for (const [record, list] of byRecord) {
      const doc = docs.find((d) => d.route === `/decisions/${record}`);
      expect(doc).toBeDefined();
      for (const decision of list) {
        const id = String(decision.number);
        if (!doc?.headings.some((h) => h.id === id)) {
          unreachable.push(`/decisions/${record}#${id} (${decision.text})`);
        }
        if (!doc?.html.includes(`id="${id}"`)) {
          unreachable.push(`/decisions/${record}#${id} is not in the HTML`);
        }
      }
    }
    expect(unreachable).toEqual([]);
  });

  it('mints a bare number only in a record', () => {
    // `N.` at the front of a heading means a decision number in `adr/` and nothing
    // anywhere else, so no other document may hand out an id somebody would read
    // as one.
    const elsewhere = docs
      .filter((doc) => !doc.route.startsWith('/decisions/'))
      .flatMap((doc) =>
        doc.headings.filter((h) => /^\d+$/.test(h.id)).map((h) => `${doc.route}#${h.id}`),
      );
    expect(elsewhere).toEqual([]);
  });
});

/**
 * One assertion's worth of failure, as a string rather than as a second argument.
 *
 * `expect(value, message)` is vitest's and oxlint's jest plugin rejects it, so the
 * guidance goes into the compared value instead — where it is also more use,
 * because it then appears in the diff rather than beside it.
 */
/** `adr/README.md`, which carries two counts of its own and is read for both. */
function readme(): string {
  return readFileSync(join(ROOT, 'adr/README.md'), 'utf8');
}

/** `adr/0029-the-handbook-keeps-its-own-primitives.md` gives the part after the number. */
function slugOf(file: string): string {
  return /(0\d{3})-(.*)\.md$/.exec(file)?.[2] ?? '';
}

function report(guidance: string, rows: string[]): string {
  return rows.length === 0 ? '' : [guidance, '', ...rows].join('\n');
}

/** A number in the spelling `adr/README.md` writes its counts in. */
function inWords(n: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];
  if (n < 20) return ones[n];
  const rest = n % 10;
  return rest === 0
    ? tens[Math.floor(n / 10)]
    : `${tens[Math.floor(n / 10)]}-${ones[rest].toLowerCase()}`;
}
