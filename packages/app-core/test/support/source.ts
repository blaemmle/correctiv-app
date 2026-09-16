/**
 * A source file with its comments taken out, and its line numbering intact.
 *
 * Three checks across two workspaces read source as text, and all three have to
 * let a comment name the thing it is explaining: `colour-tiers.test.ts` writes the
 * tier names out in its own prose, and an English comment quoting a German label
 * is exactly what AGENTS.md's language rule asks for. One helper rather than one
 * each, because the first two were copies and the bug below was in both.
 *
 * It lives in the CORE's test directory and the app re-exports it
 * (`apps/mobile/__tests__/support/source.ts`), which is the only direction that
 * works: the app depends on the core and the core must not depend on the app.
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
 *
 * **A KNOWN LIMIT, and it is the one worth knowing about.** This is a pair of
 * regular expressions and not a tokenizer, so it cannot tell a `//` inside a
 * string literal from one that opens a comment. `const s = 'a // b';` loses
 * everything from the space before the slashes, and every check built on this
 * reads the truncated line — so a German string written after a ` //` inside a
 * literal is invisible to `localisation-seam.test.ts` in both workspaces, and a
 * colour token after one is invisible to `colour-tiers.test.ts`. The `https://`
 * carve-out above is the one instance of this that occurs in practice, which is
 * why it is a carve-out and not a parser. Closing it properly means scanning
 * quotes, template literals and regex literals with their escapes, which is a
 * bug surface of its own in a helper whose failure mode is three checks passing
 * on less source than they think they read. Named rather than closed, and named
 * HERE rather than in one of them, because all three inherit it.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

/**
 * `'Pr\\u00fcfen'` written back as `'Prüfen'`, so an escape is not a way through.
 *
 * The localisation seam reads source as TEXT, and `\\u00fc` in the source is six
 * ASCII characters that no character class matches — while the string it builds is
 * German all the same. Both `\\uXXXX` spellings and `\\xXX` are decoded, because a
 * German string with one escaped letter in it is what a tool that "fixed the
 * encoding" leaves behind rather than something anybody types.
 *
 * Shared by both seams for the reason `withoutComments` is: a hole closed in one
 * workspace and not the other is a hole.
 */
export function withEscapesDecoded(source: string): string {
  return source.replace(
    /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g,
    (_match, braced: string | undefined, four: string | undefined, hex: string | undefined) =>
      String.fromCodePoint(parseInt(braced ?? four ?? (hex as string), 16)),
  );
}
