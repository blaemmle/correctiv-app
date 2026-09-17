import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * Helpers for the checks a repository makes about itself.
 *
 * Five patterns, taken out of roughly forty check files in CORRECTIV's app after
 * each of them had been written two or three times. The README beside this file has
 * them one by one, with the failure each one catches.
 *
 * **Nothing here is a test.** Every function returns what it found — a list of
 * faults, or a pair of lists — and the project's own runner is what turns a finding
 * into a failure. That is not squeamishness about depending on a test framework: two
 * of the callers that shaped these are not tests at all, but a build-time module
 * that collects the same faults and throws, so that a site does not build.
 *
 * **One module, and that is a decision rather than laziness.** This package ships
 * TypeScript source and no build, so it is read by whatever the consumer resolves
 * imports with — a bundler, a test runner's transform, or Node itself. Node's ESM
 * resolver guesses no extension, so `./files` would be `ERR_MODULE_NOT_FOUND` the
 * moment a Vite config's plugin imports this; writing `./files.ts` instead fixes
 * that and makes every TypeScript consumer turn on `allowImportingTsExtensions`,
 * because tsc pulls this source into its own program. A package with no internal
 * imports has neither problem, and a consumer needs neither a build step nor a
 * compiler flag to use it. Six sections with a banner each is the price, and the
 * README is the map.
 */

/* ========================================================================== *
 * WALKING A DIRECTORY
 * What every check below reads, and the two details that were bugs in copies of it.
 * ========================================================================== */

/**
 * Every file under a directory whose name the pattern accepts, recursively.
 *
 * It returns paths rather than contents, so a caller that wants the text says so —
 * one check parses the file, the next one strips its comments and reads it as
 * lines, and a walk that decided for them would have to be two walks.
 *
 * **Sweep the directory, do not list the files.** A check over a named list is a
 * check that stops covering the file somebody adds tomorrow, and nothing about it
 * looks wrong: it goes on passing, over less of the repository every month. That is
 * why this exists at all rather than each check naming what it reads.
 *
 * Two details a caller should not have to remember, and neither of them announces
 * itself when it goes wrong:
 *
 *  - **The pattern is used without its `g` flag.** `RegExp.prototype.test` on a
 *    global regular expression advances `lastIndex` and the next call starts from
 *    there, so a walk driven by `/\.tsx?$/g` would read roughly every second file
 *    and report nothing about the others. A check that quietly halves its own scope
 *    is the failure this whole package is about, and the flag is one character in a
 *    pattern a caller writes for the walk, so it is taken off here.
 *  - **The entries are sorted.** `readdirSync` returns them in whatever order the
 *    file system gives, which differs between a developer's machine and CI — and an
 *    offender list that comes out in a different order on the two is a list nobody
 *    can compare. Sorted by code unit rather than by `localeCompare`, because a
 *    locale-dependent order is the same problem one layer down.
 */
export function filesUnder(dir: string, pattern: RegExp, out: string[] = []): string[] {
  const accepts = stable(pattern);
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(path, accepts, out);
    else if (accepts.test(entry.name)) out.push(path);
  }
  return out;
}

/** The same test with `g` and `y` taken off, so `test` has no memory. */
function stable(pattern: RegExp): RegExp {
  const flags = pattern.flags.replace(/[gy]/g, '');
  return flags === pattern.flags ? pattern : new RegExp(pattern.source, flags);
}

/**
 * A path as an excuse list should spell it: relative to the root of the walk, with
 * `/` between the segments on every operating system.
 *
 * The separator is the whole point. An excuse table is keyed by path — `'app/
 * atlas.tsx': 5` — and a table written on Linux is a table of keys that match
 * nothing on Windows, where the walk produces `app\atlas.tsx`. Every entry then
 * reads as an excuse for a file that no longer offends, so the ratchet's stale half
 * fails for thirty files at once and its arrivals half fails for the same thirty,
 * on a checkout where nothing is wrong.
 */
export function under(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

/* ========================================================================== *
 * READING SOURCE AS TEXT
 * A prose rule applied to source hits its own explanation otherwise.
 * ========================================================================== */

/**
 * A source file with its comments taken out, and its line numbering intact.
 *
 * A prose rule applied to source hits its own explanation otherwise. The comment
 * above a rule names the thing the rule forbids — that is what a comment is for —
 * so a check that reads the file as text finds the forbidden word in the sentence
 * explaining why it is forbidden, and reports the file that documents the rule as
 * the file that breaks it. The first fix anybody reaches for is to excuse that
 * file, and then the rule is not checked there at all.
 *
 * **A block comment is replaced by the NEWLINES it occupied rather than by
 * nothing.** Deleting it outright moves every line after it up: five offenders in
 * one file of CORRECTIV's app were reported at lines 41, 42, 61, 64 and 68 when
 * they sit on 57, 58, 77, 80 and 84 — a number that looks like a line number,
 * points at the wrong line, and is wrong by a different amount in every file,
 * because the amount is that file's doc comments. Nothing about the report looks
 * broken, which is why this is the default and `withoutCommentLines` below is the
 * one you have to ask for.
 *
 * A line comment goes when `//` opens the line or follows whitespace, which leaves
 * `https://` inside a string alone: a colon precedes it there, not a space.
 *
 * **A block comment only opens where one plausibly can**, which is at a line start
 * or after whitespace or one of `;{}(),=:[`. That clause is not decoration, and the
 * failure it closes is the worst one a stripper has. Measured in CORRECTIV's app on
 * 2026-09-17, in a check that went green on a file it had read none of: a path alias
 * in a `tsconfig.json` is written `"@` slash star `"`, and the recursive globs under
 * `"include"` two dozen lines below it each carry a star followed by a slash.
 * Opening on a slash-star anywhere, the alias opened a comment and the first glob
 * closed it, and EVERYTHING BETWEEN THEM — every `paths` entry the file had — came
 * back blank. A jest configuration had the same pair in its `testMatch`. So the
 * failure was not a truncated line; it was that most of a configuration file did not
 * exist as far as its check was concerned, and the check said nothing. JSON with
 * comments and any file full of globs are where this bites, and both are exactly
 * what a repository-reading check reads.
 *
 * **A KNOWN LIMIT, and it is the one worth knowing about.** This is a pair of
 * regular expressions and not a tokenizer, so it cannot tell a `//` or a `/*`
 * inside a string literal from one that opens a comment. The clause above narrows
 * the second to the point where the spellings that occur in configuration — a glob,
 * a path alias — are safe; a slash-star written after a space inside a literal still
 * opens one. The first is not narrowed at all beyond the `https:` carve-out, so
 * `const s = 'a // b';` loses everything from the space before the slashes, and
 * every check built on this reads the truncated line. Closing either properly means
 * scanning quotes, template literals and regular-expression literals with their
 * escapes, which is a bug surface of its own in a helper whose failure mode is every
 * check built on it passing on less source than it thinks it read. Named rather than
 * closed, and named HERE rather than in each caller, because they all inherit it —
 * and `eatenByStripping` below is how a caller makes the rest of it loud.
 */
export function withoutComments(source: string): string {
  return source
    .replace(
      /(^|[\s;{}(),=:[])(\/\*[\s\S]*?\*\/)/g,
      (_match, before: string, comment: string) => before + comment.replace(/[^\n]/g, ''),
    )
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

/**
 * The documents a stripper ate: the ones that no longer READ once their comments
 * are out.
 *
 * **A stripper that can produce nonsense should be able to say so.** Every function
 * above is a regular expression and not a parser, so each of them can remove
 * something that was not a comment — and the damage is silent by construction,
 * because what the check sees afterwards is a file with less in it, not an error.
 * A truncated line costs one rule one line. A block opened by a path alias and
 * closed by a glob costs the check the whole middle of the file, and the check goes
 * green over the blank.
 *
 * The oracle cannot live inside the stripper, which is why this is a separate
 * function and not a flag: the stripper does not know what the file is supposed to
 * be, and only the caller does. What belongs here is the SHAPE of the guard, so that
 * a project writes it once rather than per check — and `reads` is the one thing it
 * asks for.
 *
 * `JSON.parse` is the default because a configuration file is the case this was
 * written for, it is where the damage was measured, and it needs no dependency. For
 * TypeScript, hand it a parser you already have; for anything else, hand it whatever
 * throws on nonsense. A whole-file oracle is what works: a check cannot ask "is this
 * still the same file" without keeping a copy of the file, which is the thing it was
 * trying to avoid.
 */
export function eatenByStripping({
  documents,
  strip = withoutComments,
  reads = JSON.parse,
}: {
  documents: Iterable<Document>;
  strip?: (source: string) => string;
  reads?: (stripped: string) => unknown;
}): string[] {
  const faults: string[] = [];
  for (const { name, text } of documents) {
    try {
      reads(strip(text));
    } catch (error) {
      faults.push(
        `${name}: taking the comments out left something its reader cannot read — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return faults.sort();
}

/**
 * The same job under a narrower rule: block comments and whole comment lines only.
 *
 * A trailing `// like this` is left where it is, and so is the `//` inside a string
 * literal that `withoutComments` cannot tell from one. That is the trade, and it is
 * a real choice rather than a weaker version of the function above:
 *
 *  - Take this one when the check reads for a LITERAL — a hex colour, a URL, a
 *    magic number — because there the string is the subject and truncating it at a
 *    `//` inside it hides the thing being looked for.
 *  - Take `withoutComments` when the check reads for a NAME that a comment would
 *    also write, and when the report carries a line number, which this one destroys
 *    by deleting the block rather than emptying it.
 *
 * Two rules rather than one because a repository that reads its own source
 * eventually wants both, and the pair is the knowledge: a project that has only the
 * first will write the second by hand the day a check punishes a comment, and it
 * will write it without the line-number argument above.
 */
export function withoutCommentLines(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

/**
 * `'Pr\\u00fcfen'` written back as `'Prüfen'`, so an escape is not a way through.
 *
 * A check that reads source as TEXT sees `\\u00fc` as six ASCII characters that no
 * character class matches — while the string it builds is German all the same, and
 * the rule being checked is about the string. Both `\\uXXXX` spellings and `\\xXX`
 * are decoded, because a word with one escaped letter in it is what a tool that
 * "fixed the encoding" leaves behind rather than something anybody types.
 *
 * Nothing here is specific to German. Any check whose subject is what a string SAYS
 * rather than what it is spelled like wants this in front of it.
 */
export function withEscapesDecoded(source: string): string {
  return source.replace(
    /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,
    (_match, braced: string | undefined, four: string | undefined, hex: string | undefined) =>
      String.fromCodePoint(parseInt(braced ?? four ?? (hex as string), 16)),
  );
}

/* ========================================================================== *
 * THE GUARD AGAINST A SILENTLY EMPTY WALK
 * The least obvious pattern here, and the one worth having on its own.
 * ========================================================================== */

/**
 * What a check counted, and the least it may count before the check has stopped
 * meaning anything.
 *
 * `atLeast` is inclusive: `found === atLeast` passes.
 */
export interface Floor {
  found: number;
  atLeast: number;
}

/**
 * The guard against a silently empty walk, which is the least obvious thing in this
 * package and the one worth having on its own.
 *
 * **A source-reading check that matches nothing passes.** Every assertion in it is
 * of the shape "the offenders are none", and a walk that read no files produces no
 * offenders, so the suite is green and says the rule holds everywhere. Nothing about
 * it looks wrong: the test name still reads correctly, the run is fast, and the
 * report is empty because there is nothing to report. The ways a walk empties itself
 * are all ordinary — a directory renamed, a glob narrowed, a resolution that now
 * points a level up, a regular expression with a `g` flag on it, a parser upgraded
 * to a version whose node kinds moved.
 *
 * So the first case in a file that reads a repository asserts that it READ the
 * repository. Not a count anybody maintains: a floor far enough below the real
 * figure that it never needs touching, and far enough above zero that an empty walk
 * cannot pass it.
 *
 * **Count every stage, not just the files.** A walk that found the files and parsed
 * nothing satisfies a floor on the file count, and then the rule underneath it is
 * checked against no elements at all. Where a check reads files, then parses them,
 * then keeps a subset, each of those three is a place the walk can empty out, and
 * each one gets a number. The failures are named rather than counted, so a
 * three-stage guard says which stage came back empty.
 *
 * **The floors may be proportional, and where the set grows they should be.** A
 * floor of "at least one" against a set where most members qualify is not a guard:
 * a collector degraded to finding a single match satisfies it, and the page or the
 * report is then confidently wrong about everything else. CORRECTIV's decision board
 * shipped exactly that — three collectors each guarded by "at least one record has
 * one", against thirty-four records of which most carry a struck claim — and the
 * guard passed while the board was wrong. A fraction of the set (`records.length /
 * 4`) is not a number anybody has to maintain as the set grows, and it fires while
 * the output is merely incomplete rather than a lie.
 *
 * Returns the faults rather than throwing or asserting, so this works in a test
 * (`expect(floorFaults({…})).toEqual([])`) and equally in the build-time module that
 * cannot use a test runner at all — where the faults are collected and thrown, and
 * the site does not build. That is the reason this package asserts nothing itself.
 */
export function floorFaults(floors: Readonly<Record<string, Floor>>): string[] {
  return Object.entries(floors)
    .filter(([, floor]) => floor.found < floor.atLeast)
    .map(
      ([what, floor]) =>
        `${what}: ${figure(floor.found)}, and this check needs at least ${figure(floor.atLeast)} to mean anything`,
    );
}

/** A proportional floor prints as a figure rather than as 8.5 of a record. */
function figure(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/* ========================================================================== *
 * THE TWO-SIDED RATCHET
 * An excuse list that can only shrink.
 * ========================================================================== */

/**
 * One thing a check found, addressed by a key an excuse list can spell.
 *
 * `as` is what the report says about it — `<View style={{ height: 44 }}> holds
 * text` — and it is deliberately not part of the key: an excuse has to go on
 * matching while the detail around it changes, or the list fails on an edit nobody
 * made to the thing it excuses.
 */
export interface Finding {
  key: string;
  as?: string;
}

/**
 * What a check excuses.
 *
 * A list of keys when there is nothing to say about them; a record when there is —
 * and there usually is. The value is either the REASON, which is the shape to
 * prefer, or a COUNT where the same key may legitimately appear more than once.
 */
export type Excuses = readonly string[] | Readonly<Record<string, string | number>>;

export interface RatchetReport {
  /** Found and not excused: what the rule has newly acquired. */
  arrivals: string[];
  /** Excused and no longer found: an excuse that has outlived its violation. */
  stale: string[];
}

/**
 * The two-sided ratchet: an excuse list that can only shrink.
 *
 * A one-sided list — "these files are allowed to break the rule" — is a list that
 * only ever grows. Nothing takes an entry out when the violation is fixed, so the
 * excuse stays, and the next person to open the file reads it as permission. The
 * list stops being a record of debt and becomes a description of the house style.
 *
 * Both directions, and the second is the one that makes a migration finishable:
 *
 *  - **arrivals** — found and not excused. The half everybody writes.
 *  - **stale** — excused and no longer found. The last violation to be fixed takes
 *    the last entry out with it, and then the rule holds everywhere rather than
 *    holding everywhere except a list nobody rereads.
 *
 * **Address an entry by the smallest thing that is still stable.** A key of
 * `file:line` fails when the thing it excuses MOVES, which is deliberate: an entry
 * that outlives the line it named hands its permission to whatever lands there
 * next. A key of `file` alone is weaker — a second violation lower down the same
 * file inherits the excuse — and is sometimes right anyway, when the file is one
 * several people edit and a line number would fail the suite on somebody else's
 * unrelated change. That is how a check gets deleted rather than fixed. Choose, and
 * write down which you chose; the stale half holds either way.
 *
 * **Counts, where one key may hold several.** Pass a count as the excuse value and
 * repeat the key in `found` once per occurrence: a fourth violation in a file that
 * was excused for three is an arrival, and a third one going takes the count down
 * with it. That is the form to use when the unit is "how many", and it is the one
 * that makes "anywhere new" include "once more in a place that already had some".
 *
 * Both lists come back sorted, because a report whose order depends on the file
 * system is a report two machines cannot compare.
 */
export function ratchet(found: Iterable<string | Finding>, excused: Excuses): RatchetReport {
  const seen = new Map<string, { count: number; as?: string }>();
  for (const one of found) {
    const { key, as } = typeof one === 'string' ? { key: one, as: undefined } : one;
    const entry = seen.get(key) ?? { count: 0, as };
    entry.count += 1;
    entry.as ??= as;
    seen.set(key, entry);
  }

  const allowed = new Map<string, number>();
  if (Array.isArray(excused)) {
    for (const key of excused as readonly string[]) allowed.set(key, (allowed.get(key) ?? 0) + 1);
  } else {
    for (const [key, value] of Object.entries(excused as Record<string, string | number>)) {
      allowed.set(key, typeof value === 'number' ? value : 1);
    }
  }

  const arrivals: string[] = [];
  for (const [key, { count, as }] of seen) {
    const excuse = allowed.get(key) ?? 0;
    if (count <= excuse) continue;
    const line = as === undefined ? key : `${key} → ${as}`;
    arrivals.push(count === 1 && excuse === 0 ? line : `${line} (×${count}, excused ×${excuse})`);
  }

  const stale: string[] = [];
  for (const [key, excuse] of allowed) {
    const count = seen.get(key)?.count ?? 0;
    if (count >= excuse) continue;
    stale.push(excuse === 1 && count === 0 ? key : `${key} (excused ×${excuse}, found ×${count})`);
  }

  return { arrivals: arrivals.sort(), stale: stale.sort() };
}

/**
 * The excuses that carry a path and no argument.
 *
 * The third assertion a ratchet wants, and it is about the prose rather than the
 * code: an entry whose value is a sentence says whether it is a debt or a fact, and
 * an entry that is only a key says nothing at all. A list of bare paths is how a
 * list of thirty-six gets to thirty-seven — nobody can tell which of them somebody
 * decided and which somebody deferred, so adding one more costs nothing.
 *
 * The floor is a length, which is a crude test for "is this an argument", and it is
 * the only one available to a string. It catches the entry written as `'TODO'` or
 * as the file name again. Forty characters is about a clause; twenty is about a
 * phrase. Pick the one that matches what the list is for and expect to argue about
 * a borderline entry in review, which is where that argument belongs.
 */
export function excusesWithoutReason(
  excused: Readonly<Record<string, string>>,
  atLeast = 40,
): string[] {
  return Object.entries(excused)
    .filter(([, why]) => why.trim().length < atLeast)
    .map(([key]) => key)
    .sort();
}

/* ========================================================================== *
 * REGENERATE AND COMPARE
 * For a fact that has a generator, which is the strongest form available.
 * ========================================================================== */

export interface Regeneration {
  /** The directory the paths below are relative to. */
  root: string;
  /** Every artefact the generator writes. All of them, not the interesting ones. */
  files: readonly string[];
  /** Runs the real generator, over the real files. */
  regenerate: () => void;
}

/**
 * Run the generator now and compare what it writes with what is committed.
 *
 * **The strongest form of check available to a fact that has a generator**, and the
 * reason is that there is no fact to keep: the committed file IS the generator's
 * output, so it cannot drift from the source it was derived from without this going
 * red. Forgetting the thing itself is a compile error; forgetting to REGENERATE is
 * what this catches, and nothing else does — an artefact edited by hand compiles,
 * passes review, and disagrees with its source for as long as nobody regenerates.
 *
 * Blind, by construction, to a generator that is wrong: then both sides are wrong
 * together and agree. That is the half a few assertions about the artefact's
 * CONTENT are for, and the two are worth keeping apart, because content assertions
 * declared beside a regeneration read whatever the regeneration just wrote.
 *
 * **This writes.** It runs the generator over the real files, because that is the
 * write path a release uses, and puts the committed bytes back afterwards so the
 * run leaves the working tree exactly as it found it — including when the generator
 * throws. Two consequences worth knowing before calling it:
 *
 *  - Give it a process of its own, or at least a file of its own. A check that
 *    rewrites files while another check is reading them is a mask waiting to
 *    happen, and a runner with parallel workers turns the mask into a race.
 *  - Where the generator HAS a seam between deciding and writing — a `render()` that
 *    returns the string `main()` writes — use the seam instead and compare the
 *    committed file with `render()` directly. No subprocess, no write, no restore.
 *    This function is for the generators that have no such seam.
 *
 * When it fails, the fix is to run the generator and commit the result. Never a
 * hand-edit of the artefact, and never a repair from inside the check, which would
 * go green on the next run with nothing done about it.
 *
 * The report names the file and the first line that differs, rather than handing a
 * test runner two ten-thousand-character strings to diff. For a generated file that
 * is the line to act on, and the action is the same whatever the diff says.
 */
export function driftAfterRegenerating({ root, files, regenerate }: Regeneration): string[] {
  const committed = readArtefacts(root, files);
  try {
    regenerate();
    const now = readArtefacts(root, files);
    return files
      .filter((file) => now[file] !== committed[file])
      .map((file) => firstDifference(file, committed[file], now[file]));
  } finally {
    for (const file of files) {
      const path = resolve(root, file);
      if (readFileSync(path, 'utf8') !== committed[file]) writeFileSync(path, committed[file]);
    }
  }
}

function readArtefacts(root: string, files: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of files) out[file] = readFileSync(resolve(root, file), 'utf8');
  return out;
}

/** `theme.css drifted at line 42: committed "…", generator now writes "…"`. */
function firstDifference(file: string, committed: string, now: string): string {
  const before = committed.split('\n');
  const after = now.split('\n');
  const at = before.findIndex((line, index) => line !== after[index]);
  if (at === -1) {
    return `${file} drifted: the generator now writes ${after.length - before.length} more lines`;
  }
  return `${file} drifted at line ${at + 1}: committed ${quote(before[at])}, generator now writes ${quote(after[at])}`;
}

function quote(line: string | undefined): string {
  if (line === undefined) return '(nothing — the file ends here)';
  const trimmed = line.trim();
  return `"${trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed}"`;
}

/* ========================================================================== *
 * A NUMBER IN PROSE, HELD TO WHAT THE CODE COUNTS
 * The one nothing published has.
 * ========================================================================== */

/** A document to read a claim out of: a name for the report, and its whole text. */
export interface Document {
  name: string;
  text: string;
}

export interface NumberInProse {
  /** The documents the sentence may be written in. All of them, not the likely one. */
  documents: Iterable<Document>;
  /**
   * The sentence, with ONE capture group around the number.
   *
   * This stays at the call site on purpose — see the note in `numberInProse`.
   */
  pattern: RegExp;
  /** What the code computes, right now. */
  value: number;
  /** What the number counts, for the report: `the core declares`, `src/ holds`. */
  what?: string;
  /**
   * `either` — a numeral or the word, whichever the prose writes.
   * `word` — the word, and a numeral of the right value is still a fault. For a
   * drawing or a caption, where a figure is written the way a sentence writes one.
   */
  spelling?: 'either' | 'word';
}

/**
 * The words a small number is written with, `no` for zero, which is how a sentence
 * writes one: "no ports", "five ports".
 */
export const NUMBER_WORDS: readonly string[] = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];

/** What prose should write for `n`: the word where there is one, the digits otherwise. */
export function spelledNumber(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * A number written in prose, held to the number the code computes.
 *
 * This is the pattern nothing published has. Link checkers verify that a link
 * resolves and snippet runners verify that a code block runs; neither has a concept
 * for "this sentence states a quantity, and the quantity is measured somewhere else
 * in the repository". A figure measured against the repository itself goes wrong
 * quietly and faster than one measured against the world: it was exact when it was
 * typed, four short a week later, and nothing failed, because nothing about a
 * sentence looks wrong.
 *
 * **What generalises and what does not**, because the division is the whole design
 * here. The PATTERN does not generalise and is not attempted: the sentence is
 * particular, its phrasing is load-bearing, and a pattern loose enough to fit three
 * different sentences would match a fourth that is not a claim at all. It stays at
 * the call site, where the argument for that phrasing can be written beside it.
 * What generalises is everything around it:
 *
 *  - the sweep over every document the sentence might be in, rather than the one it
 *    was in when the check was written;
 *  - **the guard that the pattern matched at all**, which is the empty-walk problem
 *    in its prose form and is why this returns a fault for it rather than leaving
 *    the caller a second assertion to forget. A rewritten sentence is the likeliest
 *    thing to happen to a document, and a check that silently stops finding its
 *    sentence is a check that has been deleted without anybody deciding to;
 *  - a word and a numeral being the same number, so a document may say "five" and
 *    the code may count 5;
 *  - the report, which quotes the sentence as written and says what the code says,
 *    because a fault of the shape `expected "45" to be "49"` names neither the
 *    document nor the claim.
 *
 * So: one call per sentence, the pattern written out at the call site, and the
 * faults asserted empty.
 *
 * It says nothing about a number that is not stated anywhere, and it cannot: the
 * pattern is how the claim is recognised, and a claim nobody wrote down is not a
 * claim. Where the document should state a figure and does not, the empty-match
 * fault is the one that fires.
 */
export function numberInProse({
  documents,
  pattern,
  value,
  what,
  spelling = 'either',
}: NumberInProse): string[] {
  const faults: string[] = [];
  const said = what === undefined ? `the code says ${value}` : `${what} ${value}`;
  let found = 0;

  for (const { name, text } of documents) {
    for (const match of text.matchAll(withGlobalFlag(pattern))) {
      found += 1;
      const written = (match[1] ?? '').toLowerCase();
      const states = NUMBER_WORDS.indexOf(written);
      const stated = states >= 0 ? states : Number(written);

      if (Number.isNaN(stated)) {
        faults.push(`${name} says "${match[0].trim()}", which is not a number this can read`);
      } else if (stated !== value) {
        faults.push(`${name} says "${match[0].trim()}" and ${said}`);
      } else if (spelling === 'word' && states < 0 && NUMBER_WORDS[value] !== undefined) {
        faults.push(
          `${name} says "${match[0].trim()}", which is the right number written as a numeral; spell it "${spelledNumber(value)}"`,
        );
      }
    }
  }

  if (found === 0) {
    faults.push(
      `nothing matched ${String(pattern)}, so no statement of ${said} was compared with anything`,
    );
  }

  return faults;
}

/**
 * `matchAll` throws on a pattern without `g`, and a caller writing one sentence has
 * no reason to think about the flag. Copied rather than mutated, because a regular
 * expression declared at the top of a file is shared with whatever else reads it.
 */
function withGlobalFlag(pattern: RegExp): RegExp {
  return pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}
