import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reading a source file as a check reads one, in one place.
 *
 * Both of these had been written out three and four times over, each copy with a
 * doc comment of its own, and two of the copies of `code` said "as
 * `environment.test.ts` does it" — which is a file pointing at the original
 * instead of importing it. That is the shape the duplication takes here: the
 * second author knew, and copied anyway because there was nowhere to put it.
 *
 * Nothing here is a test, so vitest does not collect it.
 */

/**
 * The same source with its prose taken out.
 *
 * Every check that reads a file for what it DOES needs this, because a file that
 * explains why it no longer calls something has to be able to name the thing it no
 * longer calls. Without it the docblock saying "applying it is the app's business,
 * not this file's" fails the check that this file does not apply it — the comment
 * punished for being accurate. The drawings need it for the same reason one turn
 * further out: their comments argue about record numbers, and a check that no
 * record number is typed would otherwise punish the argument.
 *
 * Block comments and whole comment lines only, so a `//` inside a string is left
 * where it is.
 */
export function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

/**
 * Every file under a directory whose name the pattern accepts.
 *
 * Recursive, and it returns paths rather than contents, so a caller that wants the
 * text says so. The point of sweeping a directory instead of listing files is that
 * a new one is checked without anybody remembering to add it, which is why every
 * check that could name its files instead does this.
 */
export function filesUnder(dir: string, pattern: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(path, pattern, out);
    else if (pattern.test(entry.name)) out.push(path);
  }
  return out;
}
