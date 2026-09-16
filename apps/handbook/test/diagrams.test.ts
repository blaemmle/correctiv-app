import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';

const DIAGRAMS = join(ROOT, 'apps/handbook/src/diagrams');
const CORE = join(ROOT, 'packages/app-core/src');
const PORTS_FILE = join(CORE, 'ports/index.ts');

/** The two drawings that draw the ports. The others draw something else. */
const PORT_DRAWINGS = ['CoreAndHost.tsx', 'InsideCore.tsx'];

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

/** `ports/index.ts` parsed, which is the only reading of it this file does. */
function portsFile(): ts.SourceFile {
  return ts.createSourceFile(
    'ports/index.ts',
    readFileSync(PORTS_FILE, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

/**
 * The ports, read off the DECLARATION of `CorePlatform` rather than off the text
 * of the file it stands in.
 *
 * `ports/index.ts` declares more interfaces than it has ports — `PlaybackStatus`,
 * `NowPlaying` and `ErrorReport` are shapes a port passes, not ports — so there is
 * no telling one from the other by its declaration. `CorePlatform` is the list of
 * what a host must supply, which is exactly what the drawings draw.
 *
 * It was a regex over the file's text, `/^\s*\w+\??:\s*(\w+);/gm` inside whatever
 * stood between the first `{` and the first `}` after `interface CorePlatform`,
 * and it was wrong in four ways at once, each of them silent. It captured the
 * TYPE and not the property. It stopped at the first `}`, so one member written as
 * an inline object would have truncated the list and dropped every port after it.
 * A member whose type is a union, or `Array<…>`, or that ends in a comma rather
 * than a semicolon, matched nothing and simply was not a port as far as the
 * drawings were concerned. And `readonly errors: ErrorReporter;` — the one word a
 * reviewer might add without thinking twice — matched nothing either.
 *
 * The parser has none of those edges, because it is the same one that compiles the
 * file. It reads syntax only, with no program and no checker: a member is a member
 * whatever its type is written as, and a file that no longer declares the
 * interface throws rather than yielding an empty list.
 */
function ports(): { property: string; type: string }[] {
  const source = portsFile();
  const declaration = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === 'CorePlatform',
  );
  if (!declaration) {
    throw new Error('ports/index.ts no longer declares an interface named CorePlatform');
  }
  return declaration.members.map((member) => {
    const property = member.name?.getText(source) ?? '';
    const type = ts.isPropertySignature(member) ? (member.type?.getText(source) ?? '') : '';
    if (property === '' || type === '') {
      throw new Error(`CorePlatform has a member this cannot read: ${member.getText(source)}`);
    }
    return { property, type };
  });
}

/** Every interface `ports/index.ts` declares, ports and passed shapes alike. */
function declaredInterfaces(): string[] {
  const source = portsFile();
  return source.statements
    .filter((statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement),
    )
    .map((statement) => statement.name.text);
}

/**
 * What a drawing DRAWS, which is the text inside its `<svg>` and nothing else.
 *
 * This used to be `text.includes(name)` over the whole file, and that is a weaker
 * claim than the test's name makes: every one of these files carries a caption and
 * a description list naming each port in prose, so a port could be written into
 * the list beneath a drawing that still drew four, and the check would pass on the
 * strength of the sentence describing the picture rather than the picture. Only
 * the `<svg>` is the drawing, and inside it only the text nodes: an id, a class or
 * a path is not something a reader sees.
 *
 * `{…}` is excluded along with `<…>` so that a JSX expression, and with it every
 * `{/* … *\/}` comment inside the drawing, is not read as drawn text.
 */
function drawnText(name: string): string {
  const source = readFileSync(join(DIAGRAMS, name), 'utf8');
  const svg = [...source.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0]).join('\n');
  if (svg === '') throw new Error(`${name} holds no <svg>, so nothing in it is a drawing`);
  return [...svg.matchAll(/>([^<>{}]+)</g)].map((match) => match[1]).join(' / ');
}

function drawn(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Every "five ports" / "four interfaces" in the drawings, as written. */
const PORT_COUNT_CLAIMS =
  /\b(no|one|two|three|four|five|six|seven|eight|nine|\d+)\s+(?:named\s+)?(?:ports|interfaces)\b/gi;

/**
 * The number the drawings spell out, which is the count read from the other side.
 *
 * Used as the floor for the derivation above, because the floor that stood there
 * was `toBeGreaterThan(1)` against a set of five: a derivation that had found two
 * of the five passed it, and then found both of those two drawn, and the suite was
 * green about a drawing missing three ports. There is no honest constant to put
 * here — five is not a property of anything — so what it is held to is the number
 * the drawings themselves claim, which comes from a different reading of different
 * files.
 */
function spelledPortCount(): number {
  const spelled = new Set<number>();
  for (const { text } of diagramSources()) {
    for (const match of text.matchAll(PORT_COUNT_CLAIMS)) {
      const word = match[1].toLowerCase();
      const index = NUMBER_WORDS.indexOf(word);
      spelled.add(index >= 0 ? index : Number(word));
    }
  }
  if (spelled.size !== 1) {
    throw new Error(
      `the drawings spell the number of ports ${spelled.size} different ways: ${[...spelled].join(', ')}`,
    );
  }
  return [...spelled][0];
}

describe('the drawings, against what they draw', () => {
  it('names every port the core declares, in every drawing that draws the ports', () => {
    const declared = ports();
    expect(declared.length).toBe(spelledPortCount());

    const wrong: string[] = [];
    for (const name of PORT_DRAWINGS) {
      const text = drawnText(name);
      for (const port of declared) {
        if (!drawn(text, port.type)) {
          wrong.push(`${name} draws the ports and never names ${port.type} (${port.property})`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  /**
   * The other direction, which was unasserted: a port taken OFF `CorePlatform`
   * and left in the picture.
   *
   * A drawing that names a port the core no longer has is the same fault as one
   * missing a port it does have, and it is the likelier of the two — deleting a
   * member is a one-line change and the drawings are somewhere else entirely.
   *
   * WHAT THIS CANNOT SEE: a name that has left `ports/index.ts` altogether. The
   * candidates are the interfaces that file declares, so a port whose member AND
   * whose interface were both deleted leaves a word in the drawing that nothing
   * here can recognise as having once been a port. The common case — the member
   * goes, the interface stays because something still passes that shape — is
   * caught.
   */
  it('names no port in the drawings that CorePlatform has stopped requiring', () => {
    const declared = new Set(ports().map((port) => port.type));
    // `CorePlatform` is the list, not a member of it, and a drawing is entitled to
    // label the box with it.
    const passedShapes = declaredInterfaces().filter(
      (name) => name !== 'CorePlatform' && !declared.has(name),
    );

    const stale: string[] = [];
    for (const name of PORT_DRAWINGS) {
      const text = drawnText(name);
      for (const shape of passedShapes) {
        if (drawn(text, shape)) {
          stale.push(`${name} draws ${shape}, which CorePlatform does not require`);
        }
      }
    }
    expect(stale).toEqual([]);
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

    const wrong: string[] = [];
    let found = 0;
    for (const { name, text } of diagramSources()) {
      for (const match of text.matchAll(PORT_COUNT_CLAIMS)) {
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
