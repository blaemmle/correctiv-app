// Before anything else in this module graph, because a polyfill that arrives
// after the first `formatMessage` arrives too late. Module bodies run in import
// order, and this one installs `Intl.PluralRules` on Hermes.
import './polyfills';

import type { ReactNode } from 'react';
import { IntlProvider } from 'react-intl';

import type { Locale } from '@correctiv/app-core/stores/settings';
import { useLocale } from '@/lib/store/core';

import { de } from './catalogue/de';

/**
 * Every catalogue there is, by locale.
 *
 * One entry, and the type is what keeps it honest: adding a locale to
 * `@correctiv/app-core/stores/settings` without a catalogue fails to typecheck
 * here rather than rendering English to somebody.
 */
const CATALOGUES: Record<Locale, Record<string, string>> = { de };

/**
 * The language every user-facing string is rendered in.
 *
 * **The provider is the host's**, which is why it sits here and not in the core:
 * `packages/app-core` imports no React (`test/boundary.test.ts`). The descriptors
 * themselves are plain objects and live wherever the string lives — a screen in
 * the app, and one day a vocabulary in the core.
 *
 * `defaultLocale` is **English**, and that is not a typo. A descriptor's
 * `defaultMessage` is English so that the source reads in one language
 * ([AGENTS.md](../../../../AGENTS.md#language)); German is data, in
 * `catalogue/de/`. So a missing German entry does not blank the screen, it prints
 * the English — which is a defect that looks like a feature, and is exactly why
 * `__tests__/localisation-seam.test.ts` fails on one instead of leaving it to a
 * reader to notice.
 *
 * Mounted inside `lib/env/AppEnvironment.tsx`, below the Redux Provider because
 * it reads the locale from the store, and there rather than in `app/_layout.tsx`
 * because the handbook draws the app's components through that same environment
 * ([ADR 0028](../../../../adr/0028-one-shell-and-a-route-that-declares-its-context.md)).
 * A component that formats a message would throw in the handbook otherwise.
 */
export function Localisation({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <IntlProvider locale={locale} defaultLocale="en" messages={CATALOGUES[locale]}>
      {children}
    </IntlProvider>
  );
}
