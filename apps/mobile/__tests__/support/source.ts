/**
 * The source readers, which live in the core's test directory.
 *
 * Re-exported rather than copied: `packages/app-core/test/localisation-seam.test.ts`
 * needs the same helpers, and the app may reach into the core while the core may
 * not reach back. This file is the one line that keeps the two suites reading
 * source the same way — including the limits, which are written down beside the
 * functions rather than in each caller.
 */
export {
  IMPORT_RE,
  specifier,
  withEscapesDecoded,
  withoutComments,
} from '../../../../packages/app-core/test/support/source';
