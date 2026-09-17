/**
 * Reading a source file as a check reads one, in one place.
 *
 * Both of these had been written out three and four times over, each copy with a
 * doc comment of its own, and two of the copies of `code` said "as
 * `environment.test.ts` does it" — which is a file pointing at the original
 * instead of importing it. That is the shape the duplication takes here: the
 * second author knew, and copied anyway because there was nowhere to put it.
 *
 * There is somewhere now. Both live in `@correctiv/prose-and-code`, with the
 * arguments that are about reading source rather than about this site, and this
 * file is what keeps the name `code` at the twenty-odd call sites that write it.
 * The package spells it `withoutCommentLines`, which says what it does; `code` says
 * what is left, which is the right word in a check about a drawing's text.
 *
 * Nothing here is a test, so vitest does not collect it.
 */
export { filesUnder, withoutCommentLines as code } from '@correctiv/prose-and-code';
