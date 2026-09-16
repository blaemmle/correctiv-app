#!/usr/bin/env node
/**
 * The two things about `adr/` that a person cannot check by looking.
 *
 * `new` allocates the next record number. `lock` adds newly written decisions to
 * `adr/decisions.lock.json`, the ledger `apps/handbook/test/decisions.test.ts`
 * holds the records against.
 *
 * Neither writes prose. A script that invented the skeleton of a record would be
 * writing the one part of it that has to be argued.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ADR = join(ROOT, 'adr');
const LOCK = join(ADR, 'decisions.lock.json');

/** `0022-three-tiers-of-colour.md` gives `0022`. */
const RECORD = /^(0\d{3})-.*\.md$/;

/** The same, keeping the slug: `0022-three-tiers-of-colour.md` gives `three-tiers-of-colour`. */
const SLUG = /^(0\d{3})-(.*)\.md$/;

/**
 * A decision heading, and the number it opens with.
 *
 * The same shape `apps/handbook/plugin/markdown.ts` reads to mint the anchor, and
 * deliberately a second implementation of it rather than a shared import: this is
 * plain Node and that is TypeScript inside a workspace. The two cannot drift
 * quietly, because the test reads the records with the TypeScript one and compares
 * against the ledger this file wrote — a disagreement is a missing or an extra
 * entry, which is a red test and not a silent difference.
 */
const HEADING = /^(#{2,3})\s+(\d{1,3})\.\s+(.+)$/;

function records() {
  return readdirSync(ADR)
    .filter((file) => RECORD.test(file))
    .sort()
    .map((file) => ({ number: RECORD.exec(file)[1], file, slug: SLUG.exec(file)[2] }));
}

/**
 * Record numbers on the default branch, which a stale local tree cannot see.
 *
 * The same failure as the open pull requests, from the other side: a checkout
 * that has not fetched since a record merged hands out a number that is already
 * on `main`. Returns `null` when git cannot answer, for the same reason as
 * `claimedByOpenPullRequests`.
 */
function onDefaultBranch() {
  try {
    const raw = execFileSync('git', ['ls-tree', '--name-only', 'origin/main', 'adr/'], {
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new Set(
      raw
        .split('\n')
        .map((path) => /^adr\/(0\d{3})-.*\.md$/.exec(path)?.[1])
        .filter(Boolean),
    );
  } catch {
    return null;
  }
}

/**
 * `{ '1': 'Decision', '2': 'The label is the part with a rule behind it' }`
 *
 * A number written twice in one record is returned as a duplicate rather than
 * silently overwritten. The test catches it too, but this runs first and would
 * otherwise print "1 decision added" about a record it had just mangled.
 */
function decisionsIn(file) {
  const found = {};
  const doubled = [];
  for (const line of readFileSync(join(ADR, file), 'utf8').split('\n')) {
    const hit = HEADING.exec(line);
    if (!hit) continue;
    if (found[hit[2]] !== undefined) doubled.push(hit[2]);
    found[hit[2]] = hit[3].trim();
  }
  return { found, doubled };
}

/**
 * Record numbers claimed by an open pull request, which the directory cannot see.
 *
 * This is the half that matters. On 2026-09-16 two records both claimed 0034: two
 * agents read "the highest here is 0033" off the same tree, and because the
 * filenames differed by their slug git merged them without a conflict. The tree is
 * the thing that agreed with both of them.
 *
 * One `gh` call for every open pull request and its changed files. If `gh` is not
 * installed, not authenticated or slow enough to time out, this returns `null`
 * rather than an empty set, so the caller can say the number is from the tree alone
 * instead of implying it checked.
 */
function claimedByOpenPullRequests() {
  try {
    const raw = execFileSync(
      'gh',
      ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,files'],
      { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const claims = new Map();
    for (const pr of JSON.parse(raw)) {
      for (const { path } of pr.files ?? []) {
        const hit = /^adr\/(0\d{3})-.*\.md$/.exec(path);
        if (hit) claims.set(hit[1], pr.number);
      }
    }
    return claims;
  } catch {
    return null;
  }
}

function next() {
  const inTree = records().map((r) => r.number);
  const claimed = claimedByOpenPullRequests();
  const merged = onDefaultBranch();
  const taken = new Set(inTree);
  if (claimed) for (const number of claimed.keys()) taken.add(number);
  if (merged) for (const number of merged) taken.add(number);

  const highest = Math.max(...[...taken].map(Number));
  const free = String(highest + 1).padStart(4, '0');

  console.log(`In adr/:            ${inTree.length} records, highest ${inTree.at(-1)}`);

  // Only what the tree does NOT already have. The first version listed every
  // record any open pull request touched, which on the day it was written was
  // 34 rows of which one mattered — and the one that mattered was last.
  if (claimed === null) {
    console.log('Open pull requests: NOT READ — `gh` failed or is unavailable.');
  } else {
    const news = [...claimed].filter(([number]) => !inTree.includes(number));
    console.log(
      news.length === 0
        ? 'Open pull requests: no record number the tree does not have'
        : `Open pull requests: ${news.map(([n, pr]) => `${n} (#${pr})`).join(', ')}`,
    );
  }

  if (merged === null) {
    console.log('On origin/main:     NOT READ — git could not answer.');
  } else {
    const news = [...merged].filter((number) => !inTree.includes(number));
    console.log(
      news.length === 0
        ? 'On origin/main:     nothing the tree does not have'
        : `On origin/main:     ${news.join(', ')} — this checkout is behind`,
    );
  }

  console.log('');

  // The number is printed either way, because a person asking for it is about to
  // write a record and a blank answer helps nobody. What changes is the exit
  // code: a caller that scripts this gets a failure, and a number from the tree
  // alone is exactly what produced the duplicate 0034 on 2026-09-16.
  if (claimed === null || merged === null) {
    console.log(`Next free number:   ${free}  — UNVERIFIED, see above`);
    console.log('');
    console.log('The sources that were not read are the ones that catch a number');
    console.log('already taken somewhere this working tree cannot see.');
    process.exitCode = 1;
    return;
  }

  console.log(`Next free number:   ${free}`);
  console.log(`Write it as         adr/${free}-a-slug-of-the-title.md`);
  console.log('and list it in      adr/README.md');
}

/**
 * Adds decisions the ledger has not seen, and refuses every move it could be.
 *
 * Append-only is the whole property, and it has two halves that are easy to
 * confuse. Regenerating this file wholesale would accept a renumbering in silence,
 * which is the failure the ledger exists to make loud. But refusing every change
 * and telling the author to edit the file by hand is not stricter — it is the same
 * check with a hole in it, because a hand-edit is exactly how a swap is made to
 * look like two rewords. A cold review demonstrated that on 2026-09-16.
 *
 * So a reword is APPENDED here rather than refused, and what is refused is any
 * text that has ever stood under a different number, in this record or another.
 * That is the move; the reword is not. The history is what makes the difference
 * visible, and it is the reason an entry is a list.
 */
function lock() {
  const ledger = JSON.parse(readFileSync(LOCK, 'utf8'));
  const refusals = [];
  let added = 0;
  let appended = 0;

  // Every text the ledger has ever held, and where. Built before anything is
  // written, so a decision moved between two records is seen from both ends
  // regardless of which one the loop reaches first.
  // Two maps, because a text means different things at the two scales.
  //
  // WITHIN a record the check is strict: a text standing under two numbers is the
  // signature of a swap that was hand-edited to look like two rewords. The edited
  // file is self-consistent and so is each history on its own; only the pair gives
  // it away.
  //
  // ACROSS records it can only be as strict as the text is distinctive, and most
  // of these are not: 26 records state one unsectioned decision, so their §1 reads
  // "Decision" and always will. A text held in more than one place says nothing
  // about a move, so only a text held in exactly one place is guarded here. That
  // is the half where a citation is actually at risk, and the limit is worth
  // knowing rather than papering over with a check that cannot mean anything.
  const placesOf = new Map();
  for (const [number, entry] of Object.entries(ledger)) {
    const withinRecord = new Map();
    for (const [n, history] of Object.entries(entry.decisions ?? {})) {
      for (const text of history) {
        const here = `${number} §${n}`;
        const already = withinRecord.get(text);
        if (already !== undefined && already !== here) {
          refusals.push(`  ${here} and ${already} have both held\n    ${text}`);
        }
        withinRecord.set(text, here);
        placesOf.set(text, [...(placesOf.get(text) ?? []), here]);
      }
    }
  }
  /** Where a text stands, when it stands in exactly one place. */
  const soleHome = (text) => (placesOf.get(text)?.length === 1 ? placesOf.get(text)[0] : undefined);

  for (const { number, file, slug } of records()) {
    const entry = (ledger[number] ??= { slug, decisions: {} });

    // The record's identity, which nothing checked until a cold review deleted
    // 0029 and wrote a different record under the same number with every test
    // green. A number is a citation; the document it points at cannot change.
    if (entry.slug !== slug) {
      refusals.push(
        `  ${number} is a different record now\n    was: ${entry.slug}\n    now: ${slug}`,
      );
      continue;
    }

    const { found, doubled } = decisionsIn(file);
    for (const n of doubled) refusals.push(`  ${number} §${n} is written twice in ${file}`);
    if (doubled.length > 0) continue;

    for (const [n, text] of Object.entries(found)) {
      const history = entry.decisions[n];
      const here = `${number} §${n}`;
      const elsewhere = soleHome(text);

      if (history === undefined) {
        if (elsewhere !== undefined) {
          refusals.push(
            `  ${here} would take text that already stands at ${elsewhere}\n    ${text}`,
          );
          continue;
        }
        entry.decisions[n] = [text];
        placesOf.set(text, [...(placesOf.get(text) ?? []), here]);
        added++;
      } else if (history.at(-1) !== text) {
        if (elsewhere !== undefined && elsewhere !== here) {
          refusals.push(
            `  ${here} would take text that already stands at ${elsewhere}\n    ${text}`,
          );
          continue;
        }
        history.push(text);
        placesOf.set(text, [...(placesOf.get(text) ?? []), here]);
        appended++;
      }
    }

    entry.decisions = Object.fromEntries(
      Object.entries(entry.decisions).sort(([a], [b]) => Number(a) - Number(b)),
    );
  }

  if (refusals.length > 0) {
    console.error('Nothing written:');
    console.error(refusals.join('\n'));
    console.error('');
    console.error('A number is cited across the repository. It never moves to another');
    console.error('decision, and a record number never points at another document. If a');
    console.error('heading was only reworded, this would have appended it on its own.');
    process.exitCode = 1;
    return;
  }

  const sorted = Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LOCK, `${JSON.stringify(sorted, null, 2)}\n`);

  // Handed to the repository's formatter rather than imitating it. `JSON.stringify`
  // puts every array on four lines and oxfmt puts a short one on one, so a tool
  // that wrote its own spelling would leave `npm run check` red after every run
  // and the fix would be a second serializer to keep in step with the first.
  try {
    execFileSync('npx', ['oxfmt', LOCK], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 60_000 });
  } catch {
    console.error(`Written, but oxfmt could not format ${LOCK}. Run \`npx oxfmt\` on it.`);
    process.exitCode = 1;
  }
  const parts = [];
  if (added > 0) parts.push(`${added} decision${added === 1 ? '' : 's'} added`);
  if (appended > 0) parts.push(`${appended} reworded heading${appended === 1 ? '' : 's'} recorded`);
  console.log(
    parts.length > 0 ? `${parts.join(', ')} in adr/decisions.lock.json` : 'Nothing to add.',
  );
}

const command = process.argv[2];
if (command === 'new') next();
else if (command === 'lock') lock();
else {
  console.error('usage: node scripts/adr.mjs new|lock');
  process.exitCode = 2;
}
