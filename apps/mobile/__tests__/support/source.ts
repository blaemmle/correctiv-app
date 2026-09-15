/**
 * A source file with its comments taken out, and its line numbering intact.
 *
 * Two checks in this directory read source as text, and both have to let a comment
 * name the thing it is explaining: `colour-tiers.test.ts` writes the tier names out
 * in its own prose, and an English comment quoting a German label is exactly what
 * AGENTS.md's language rule asks for. One helper rather than one each, because the
 * two were copies and the bug below was in both.
 *
 * A block comment is replaced by the NEWLINES it occupied rather than by nothing.
 * Deleting it outright moves every line after it up: `app/atlas.tsx`'s five
 * `grey-500`s were reported at 41, 42, 61, 64 and 68 when they sit on 57, 58, 77,
 * 80 and 84 — a number that looks like a line number, points at the wrong line, and
 * is wrong by a different amount in every file, because the amount is that file's
 * doc comments.
 *
 * A line comment goes when `//` opens the line or follows whitespace, which leaves
 * `https://` inside a string alone: a colon precedes it there, not a space.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}
