import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';

const DIAGRAMS = join(ROOT, 'apps/handbook/src/diagrams');
const CORE = join(ROOT, 'packages/app-core/src');

/**
 * The drawings say things about the core, and nothing about them looks wrong when
 * they stop being true.
 *
 * The facts here are measured against `packages/app-core` rather than against the
 * outside world, which is the faster of the two ways a figure goes quiet
 * (AGENTS.md → "Facts that expire"). Both of them had already drifted when this
 * file was written: a fifth port was declared and the drawings still drew four,
 * and the core had grown a directory while the file count under it still said 54.
 * Neither broke a build, and neither would have.
 *
 * Every figure is stated in more than one place on purpose — a drawing has a
 * label, a caption and a list that replaces it for anyone who cannot see it, and
 * all three have to say the same thing. So the rule is not "write it once"; it is
 * "write it wherever it belongs, and let this file fail when two of them part".
 */

/** Every source of the drawings, so a new one is checked without being listed. */
function diagramSources(): { name: string; text: string }[] {
  return readdirSync(DIAGRAMS)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(DIAGRAMS, name), 'utf8') }));
}

/** Every `.ts`/`.tsx` under a directory, counted the way the drawings count them. */
function countSources(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countSources(join(dir, entry.name));
    else if (/\.tsx?$/.test(entry.name)) total += 1;
  }
  return total;
}

/**
 * The ports, taken from `CorePlatform` rather than from the interfaces in the file.
 *
 * `ports/index.ts` declares more interfaces than it has ports — `PlaybackStatus`,
 * `NowPlaying` and `ErrorReport` are shapes a port passes, not ports — so there is
 * no telling one from the other by its declaration. `CorePlatform` is the list of
 * what a host must supply, which is exactly what the drawings draw.
 */
function ports(): string[] {
  const source = readFileSync(join(CORE, 'ports/index.ts'), 'utf8');
  const body = /export interface CorePlatform \{([^}]*)\}/.exec(source)?.[1];
  if (!body) throw new Error('ports/index.ts no longer declares an interface named CorePlatform');
  return [...body.matchAll(/^\s*\w+\??:\s*(\w+);/gm)].map((match) => match[1]);
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

describe('the drawings, against what they draw', () => {
  it('names every port the core declares, in every drawing that draws the ports', () => {
    const declared = ports();
    expect(declared.length).toBeGreaterThan(1);

    const missing: string[] = [];
    for (const name of ['CoreAndHost.tsx', 'InsideCore.tsx']) {
      const text = readFileSync(join(DIAGRAMS, name), 'utf8');
      for (const port of declared) {
        if (!text.includes(port)) missing.push(`${name} draws the ports and never names ${port}`);
      }
    }
    expect(missing).toEqual([]);
  });

  /**
   * A count in front of the word is read as a claim about the total.
   *
   * That makes one phrasing off limits, and it is worth knowing which: a SUBSET
   * cannot be spelled with a numeral either ("the two storage ports"), because
   * nothing here can tell that apart from a total that has gone stale. Say it
   * another way — "both storage ports", "the two storage interfaces", "four of
   * them" — and the sentence is as clear while this check still means something.
   */
  it('says how many ports there are, and the number is the number', () => {
    const total = ports().length;
    const expected = NUMBER_WORDS[total] ?? String(total);
    const claims =
      /\b(no|one|two|three|four|five|six|seven|eight|nine|\d+)\s+(?:named\s+)?(?:ports|interfaces)\b/gi;

    const wrong: string[] = [];
    let found = 0;
    for (const { name, text } of diagramSources()) {
      for (const match of text.matchAll(claims)) {
        found += 1;
        if (match[1].toLowerCase() !== expected) {
          wrong.push(`${name} says "${match[0]}" and the core declares ${total}`);
        }
      }
    }

    expect(found).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });

  it("counts the core's files the way the fourth drawing says it does", () => {
    const actual = countSources(CORE);
    const wrong: string[] = [];
    let found = 0;
    for (const { name, text } of diagramSources()) {
      for (const match of text.matchAll(/(\d+)\s+TypeScript files/g)) {
        found += 1;
        if (Number(match[1]) !== actual) {
          wrong.push(`${name} says "${match[0]}" and packages/app-core/src holds ${actual}`);
        }
      }
    }

    expect(found).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});
