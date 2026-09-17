/**
 * A source file with its comments taken out, and its line numbering intact.
 *
 * Several checks across two workspaces read source as text, and every one of them
 * has to let a comment name the thing it is explaining: `colour-tiers.test.ts`
 * writes the tier names out in its own prose, an English comment quoting a German
 * label is exactly what AGENTS.md's language rule asks for, and `src/global.css`
 * explains at length which workbench test fails if its `@source` line goes. One
 * helper rather than one each, because the first two were copies and the bug below
 * was in both. No count here on purpose: it was three, it is more now, and a number
 * in a comment is a fact nothing reads back.
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
 * **A block comment only opens where one plausibly can**, which is at a line start
 * or after whitespace or one of `;{}(),=:[`. That clause is not decoration, and it
 * was added on 2026-09-17 after a check went green on a file it had read none of.
 * A path alias in `apps/mobile/tsconfig.json` is written `"@` slash star `"`, and
 * the recursive globs under `"include"` two dozen lines below it each carry a star
 * followed by a slash. Opening on a slash-star anywhere, the alias opened a comment
 * and the first glob closed it, and EVERYTHING BETWEEN THEM — every `paths` entry
 * the file has — came back blank. `jest.config.js` has the same pair in `testMatch`.
 * So the failure was not that a line was truncated; it was that most of a
 * configuration file did not exist as far as its check was concerned, and the check
 * said nothing.
 *
 * **A KNOWN LIMIT, and it is the one worth knowing about.** This is a pair of
 * regular expressions and not a tokenizer, so it cannot tell a slash-slash or a
 * slash-star inside a string literal from one that opens a comment. The clause above
 * narrows the second to the point where the spellings that occur here — a glob, a
 * path alias — are safe; a slash-star written after a space inside a literal still
 * opens one. The first is not narrowed at all beyond the `https:` carve-out, so a
 * literal holding a space and two slashes loses everything from that space onwards,
 * and every check built on this reads the truncated line — a German string written
 * after one inside a literal is invisible to `localisation-seam.test.ts` in both
 * workspaces, and a colour token after one is invisible to `colour-tiers.test.ts`.
 * Closing either properly means scanning quotes, template literals and regex
 * literals with their escapes, which is a bug surface of its own in a helper whose
 * failure mode is every check built on it passing on less source than it thinks it
 * read. Named rather than closed, and named HERE rather than in one of them,
 * because every one of them inherits it.
 *
 * `apps/mobile/__tests__/no-workbench-dependency.test.ts` carries the guard that
 * makes the blank-file failure visible rather than quiet: every JSON it reads still
 * has to parse once its comments are out.
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

/**
 * Every form in which a module name can enter a file. Three alternatives, in this
 * order, because the first that matches at a position wins and consumes the text:
 *
 *  1. `import 'react-native'` — a side-effect import, which has no `from` at all
 *     and is exactly how one pulls in a module for what it does to globals.
 *  2. `import('…')` and `require('…')` — the runtime forms. `require` matters even
 *     in an ESM package: a `.js` under `src` is read by whatever loads it, and it
 *     is the spelling a copied snippet arrives in.
 *  3. `import … from '…'` / `export … from '…'`, over as many lines as it takes.
 *
 * The lookbehind keeps `myImport(` and `foo.require(` out, and `[^;]*?` keeps the
 * third alternative inside one statement — without it a `from`-less `export { a };`
 * swallows the lines after it, side-effect imports included.
 *
 * Here rather than in one of its callers for the reason the two above are: it is
 * read by `boundary.test.ts` in this workspace, which asks what the core imports,
 * and by `apps/mobile/__tests__/no-workbench-dependency.test.ts`, which asks what
 * the app imports. Two copies of a regular expression is two nets, and the one that
 * stops matching goes quiet rather than red. `boundary.test.ts` carries the fixture
 * that proves it still catches every form it claims to, and that fixture is
 * therefore the proof for both.
 *
 * **A KNOWN LIMIT.** A specifier that is not a literal — `import(someVariable)`,
 * `require(join(dir, name))` — has no text to match and is invisible here.
 */
export const IMPORT_RE = new RegExp(
  [
    String.raw`(?<![\w$.])import\s*['"]([^'"]+)['"]`,
    String.raw`(?<![\w$.])(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)`,
    String.raw`(?<![\w$.])(?:import|export)[^;]*?\bfrom\s+['"]([^'"]+)['"]`,
  ].join('|'),
  'g',
);

/** The module name out of whichever alternative of `IMPORT_RE` matched. */
export function specifier(match: RegExpMatchArray): string | undefined {
  return match[1] ?? match[2] ?? match[3];
}
