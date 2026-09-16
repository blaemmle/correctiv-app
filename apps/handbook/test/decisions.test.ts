import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { adrFiles, collectDocs, ROOT } from '../plugin/collect.ts';
import { CAVEAT_MARKERS } from '../plugin/decisions.ts';

const { module } = collectDocs();
const RECORDS = module.decisions;
const BY_NUMBER = new Map(RECORDS.map((record) => [record.number, record]));
const source = (number: string) =>
  readFileSync(
    join(ROOT, adrFiles().find((file) => file.includes(`/${number}-`)) as string),
    'utf8',
  );

/**
 * What the decisions board is allowed to say about the records.
 *
 * Every assertion here has a way of failing that leaves the page rendering: a
 * board with thirty-three rows, no dates and every record standing looks exactly
 * like a working one, which is why `buildDecisions` throws as well. These are the
 * things a throw cannot see — a figure that is present and wrong.
 */
describe('the decision records the board is built from', () => {
  it('reads one record per file in `adr/`, in number order', () => {
    // Counted from the directory rather than typed. A record is added by writing
    // one, and a test that had to be edited alongside would just be edited
    // alongside, which is how an assertion stops being one.
    expect(RECORDS.length).toBe(adrFiles().length);
    const numbers = RECORDS.map((record) => record.number);
    expect(numbers).toEqual(numbers.toSorted());
  });

  it('gives every record a date, a status, a title and a sentence from the index', () => {
    const empty = RECORDS.filter(
      (record) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
        record.status === '' ||
        record.title === '' ||
        record.note === '',
    );
    expect(empty.map((r) => `${r.number}: ${r.date} / ${r.status} / ${r.note}`)).toEqual([]);
  });

  it('strips the record number out of the title, which has its own column', () => {
    expect(RECORDS.filter((record) => record.title.startsWith('ADR')).map((r) => r.number)).toEqual(
      [],
    );
    expect(BY_NUMBER.get('0022')?.title).toBe(
      'Three tiers of colour, and a dark scheme that names roles',
    );
  });

  /**
   * The count has to come from the files, not from a number typed here.
   *
   * This is the assertion that would catch the board over- or under-counting: a
   * collector that walks a list and its items both reports a strike twice, and a
   * hard-coded expectation would simply have been written as the wrong number.
   */
  it('counts exactly the strikes that are in the records', () => {
    const marks = adrFiles().reduce(
      (total, file) => total + (readFileSync(join(ROOT, file), 'utf8').match(/~~/g)?.length ?? 0),
      0,
    );
    const struck = RECORDS.reduce((total, record) => total + record.struck.length, 0);
    expect(marks % 2).toBe(0);
    expect(struck).toBe(marks / 2);
    expect(struck).toBeGreaterThan(20);
  });

  it('derives the standing from the strikes rather than from a status word', () => {
    const wrong = RECORDS.filter(
      (record) =>
        (record.standing === 'stands') !== (record.struck.length === 0) &&
        record.standing !== 'withdrawn',
    );
    expect(wrong.map((r) => `${r.number}: ${r.standing} with ${r.struck.length} struck`)).toEqual(
      [],
    );
    // All three states are reachable, so a bug that collapsed two of them shows.
    expect(new Set(RECORDS.map((r) => r.standing))).toEqual(
      new Set(['stands', 'partly-struck', 'withdrawn']),
    );
  });

  it('withdraws only a record whose own status line is struck through', () => {
    const withdrawn = RECORDS.filter((record) => record.standing === 'withdrawn');
    expect(withdrawn.map((r) => r.number)).toEqual(['0002']);
    for (const record of withdrawn) {
      const status = source(record.number)
        .split(/\n{2,}/)
        .find((block) => /^\*{0,2}Status:/.test(block.trim())) as string;
      expect(status).toContain('~~');
    }
  });
});

describe('the retirement graph', () => {
  it('names only records that exist', () => {
    const unknown = RECORDS.flatMap((record) => [...record.voidedBy, ...record.voids]).filter(
      (number) => !BY_NUMBER.has(number),
    );
    expect(unknown).toEqual([]);
  });

  it('finds edges at all', () => {
    // Guards against the citation regex quietly matching nothing, which would
    // leave every record reading "struck by no later record" and look deliberate.
    const edges = RECORDS.reduce((total, record) => total + record.voidedBy.length, 0);
    expect(edges).toBeGreaterThan(10);
  });

  /**
   * A record can only be made false by a later one.
   *
   * ADR 0026 strikes its own "Nothing in another ADR." with the clause "Two cells
   * in ADR 0006's ports table, struck there when section 4 was carried out". The
   * clause names 0006 because that is where 0026 did the striking, and reading the
   * citation as an edge puts the arrow the wrong way round — the board would tell
   * a reader that a 2026-08-06 record retired a claim in a 2026-09-10 one.
   */
  it('reads a citation of an earlier record as a reference, not as an edge', () => {
    const backwards = RECORDS.flatMap((record) =>
      record.voidedBy.filter((by) => by <= record.number).map((by) => `${by} -> ${record.number}`),
    );
    expect(backwards).toEqual([]);

    expect(BY_NUMBER.get('0026')?.voidedBy).not.toContain('0006');
    // And the real edge between those two, which runs the other way.
    expect(BY_NUMBER.get('0026')?.voids).toContain('0006');
    expect(BY_NUMBER.get('0006')?.voidedBy).toContain('0026');
  });

  it('reads the same edge from both ends', () => {
    const wrong: string[] = [];
    for (const record of RECORDS) {
      for (const by of record.voidedBy) {
        if (!BY_NUMBER.get(by)?.voids.includes(record.number)) {
          wrong.push(`${by} voided a claim in ${record.number} and does not say so`);
        }
      }
      for (const number of record.voids) {
        if (!BY_NUMBER.get(number)?.voidedBy.includes(record.number)) {
          wrong.push(`${record.number} claims a strike in ${number}, which does not carry it`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('what the index says is not built', () => {
  it('takes the caveat from the index row it stands in', () => {
    const outside = RECORDS.flatMap((record) =>
      record.caveats
        .filter((caveat) => !record.note.includes(caveat))
        .map((caveat) => `${record.number}: ${caveat}`),
    );
    expect(outside).toEqual([]);
  });

  it('finds one wherever the index note says something is unbuilt or unchecked', () => {
    const missed = RECORDS.filter(
      (record) => CAVEAT_MARKERS.test(record.note) !== record.caveats.length > 0,
    );
    expect(missed.map((r) => `${r.number}: ${r.note}`)).toEqual([]);
    expect(RECORDS.filter((r) => r.caveats.length > 0).length).toBeGreaterThan(2);
  });

  /**
   * Both records that say it, not only the one that shouts it.
   *
   * The first version of this took the index's **bold** spans, on the argument
   * that bolding is a deliberate act. It reads the set wrongly: ADR 0030 bolds
   * "iOS unrun" and ADR 0013 writes the same words plain, and a board that flagged
   * one and not the other would be inventing a distinction the index never made.
   */
  it('flags both of the records whose iOS half is unrun', () => {
    const unrun = RECORDS.filter((record) => record.caveats.some((c) => c.includes('unrun')));
    expect(unrun.map((r) => r.number)).toEqual(['0013', '0030']);
  });
});

describe('the board page', () => {
  const page = readFileSync(join(ROOT, 'apps/handbook/src/pages/Decisions.tsx'), 'utf8');

  /**
   * Nothing about a particular record is typed into the page.
   *
   * The failure this prevents is the one the sources board's own comments are
   * about: a figure typed on a page, a figure derived from the sources, and the
   * page being the confident one. A record number in this file would be the first
   * step of it.
   */
  it('names no record of its own', () => {
    const cited = [...withoutComments(page).matchAll(/(?<![\w-])0\d{3}(?![\w-])/g)].map(
      (hit) => hit[0],
    );
    expect(cited).toEqual([]);
  });

  it('reads its records from the virtual module and nowhere else', () => {
    expect(page).toContain("import docsModule from 'virtual:docs'");
    expect(page).toContain('docsModule.decisions');
  });
});

/**
 * The source with every comment removed, so prose may cite a record and code may not.
 *
 * Both forms, because a page written in JSX has both: `{/* … *\/}` around markup and
 * `//` beside a line. The first version of this test read line by line and looked for
 * a leading `*`, which passes a JSDoc block and fails the second line of a JSX
 * comment — it reported a record cited inside an explanation of why a key is what it
 * is.
 */
function withoutComments(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');
}
