/**
 * The two `Intl` objects Hermes does not ship, installed before anything formats.
 *
 * Measured against the Hermes actually in use, `hermes-android 250829098.0.17`,
 * arm64: the VM exposes `Intl.Collator`, `Intl.DateTimeFormat`, `Intl.NumberFormat`
 * and `Intl.getCanonicalLocales`, and NOT `PluralRules`, `RelativeTimeFormat`,
 * `ListFormat`, `DisplayNames`, `Locale` or `Segmenter`
 * ([ADR 0026](../../../../adr/0026-react-native-review-and-hardening.md) §6).
 * `react-intl` needs `PluralRules` for any plural message, so this is not a
 * second-language problem: the first German plural crashes without it.
 *
 * **Conditional, and `require` rather than `import`.** A static import runs on
 * every platform, and web and iOS have both objects natively — the polyfill is
 * some 90 KB of CLDR data each, parsed at startup, to replace an implementation
 * that is already there and better. Only a `require` inside the branch can be
 * skipped at runtime; Metro still bundles it, which is the trade
 * ([ADR 0025](../../../../adr/0025-the-published-app-is-a-production-bundle.md)
 * measured the same thing for the DevTools enhancer).
 *
 * Imported for its side effect by `i18n/Localisation.tsx`, whose module body runs
 * before any provider mounts. Nothing else should import it.
 *
 * `npm run build:handbook` prints three `IMPORT_IS_UNDEFINED` warnings at the
 * lines below, and they are expected: rolldown compiles a `require` of an ESM
 * module into `(ns.default || ns)`, these three modules export nothing at all, and
 * the value is discarded either way. The app's own bundler says nothing, and the
 * polyfill installs itself in both.
 *
 * `@formatjs/intl-relativetimeformat` is the next one, and it is missing too — it
 * arrives the first time a string says "vor drei Tagen".
 */

if (!('PluralRules' in Intl)) {
  // The `.js` is load-bearing: this package's `exports` map names
  // `./polyfill.js` and `./locale-data/*`, so the extensionless spellings the
  // README uses resolve to nothing under package exports.
  require('@formatjs/intl-pluralrules/polyfill.js');
  // German only. The app ships one language, and the full locale data is
  // megabytes.
  require('@formatjs/intl-pluralrules/locale-data/de.js');
}

if (!('Locale' in Intl)) {
  require('@formatjs/intl-locale/polyfill.js');
}
