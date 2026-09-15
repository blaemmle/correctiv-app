/**
 * German for the `core.*` ids: the core's own vocabulary, lifted out of
 * packages/app-core. Empty until those strings are lifted.
 *
 * One measured thing to know before filling it. The core cannot import
 * `react-intl` — it imports no React at all, and
 * `packages/app-core/test/boundary.test.ts` fails the build over it — so a core
 * descriptor is a plain `{ id, defaultMessage }` object. `@formatjs/cli` extracts
 * from `defineMessages`, `<FormattedMessage>` and `intl.formatMessage` and from
 * nothing else: a bare object literal extracts to zero messages, verified against
 * this repo's own core on 2026-09-15. Whatever helper the core wraps its
 * descriptors in has to be named to `npm run i18n:extract` through
 * `--additional-function-names`, or the ids here will have no English side and
 * `__tests__/localisation-seam.test.ts` will say so.
 */
export const core: Record<string, string> = {};
