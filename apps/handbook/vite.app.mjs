/*
 * What the handbook needs in order to build a component out of `apps/mobile`.
 *
 * Two callers share it and must not drift: `vite.config.ts`, which builds the
 * site, and `scripts/measure-direct.mjs`, which builds one component at a time
 * and counts. A recipe that lived only in the site's config would make the
 * measurement a different build from the one it claims to measure, which is the
 * mistake ADR 0027 records having already made once.
 *
 * JavaScript rather than TypeScript because the measurement script is plain Node
 * and imports this file directly. `tsconfig.base.json` sets `allowJs`, so the
 * site's config still gets it checked.
 */

import { fileURLToPath } from 'node:url';

import { uniwind } from 'uniwind/vite';
import { rnw } from 'vite-plugin-rnw';

/** `apps/mobile/src`, which is what the app's own `@/` means. */
export const APP_SRC = fileURLToPath(new URL('../mobile/src', import.meta.url));

/**
 * The app's stylesheet, as Uniwind wants it: a path it joins onto `process.cwd()`.
 *
 * So every caller has to run with `apps/handbook` as the working directory, and
 * both of them say so. Uniwind reads this file to learn the theme names and the
 * variables behind them; it is the app's `global.css` and not the handbook's
 * `styles/app.css`, because a drawn component's `bg-canvas` has to mean what it
 * means inside the app. The handbook's own sheet keeps Tailwind's standalone
 * build of the same tokens for the site around it.
 */
export const APP_CSS_ENTRY = '../mobile/src/global.css';

/**
 * Metro's platform split, spelled for a bundler that does not have one.
 *
 * `.web.*` ahead of the bare extensions, because two packages in the app's tree
 * ship a web file beside a native one and nothing but this order picks it:
 * `react-native-safe-area-context` (`SafeAreaView.web.js`,
 * `NativeSafeAreaProvider.web.js`) and `react-native-screens`
 * (`DebugContainer.web.js`). `vite-plugin-rnw` carries a list of its own, and it
 * is not enough — a plugin's `config()` result is appended to the user's and
 * arrays concatenate, so a bare `.js` written at this level wins over the
 * plugin's `.web.js` and the split silently does not happen.
 *
 * This is the larger half of the recipe, not a detail. Measured on 2026-09-11 by
 * shortening this list to the bare extensions with the plugin still in place:
 * **7 of 47 build**, the same number as with no recipe at all. The forty that
 * fail do so on
 * `[UNLOADABLE_DEPENDENCY] Could not load react-native-web/Libraries/Utilities/codegenNativeComponent`
 * (from `react-native-safe-area-context/lib/module/specs/NativeSafeAreaView.js`)
 * and `…/Libraries/ReactNative/AppContainer` (from
 * `react-native-screens/lib/module/components/DebugContainer.js`) — files the
 * native halves reach and the web halves never do. The seven survivors are the
 * seven that import neither. (ADR 0027.)
 */
export const WEB_FIRST_EXTENSIONS = [
  '.web.tsx',
  '.web.ts',
  '.web.mjs',
  '.web.js',
  '.tsx',
  '.ts',
  '.mjs',
  '.js',
  '.jsx',
  '.mts',
  '.cjs',
  '.json',
];

/** `resolve` for a build that draws the app's components. Belongs in the user config. */
export const appResolve = {
  extensions: WEB_FIRST_EXTENSIONS,
  /*
   * Array form and a regular expression, not `{'@': …}`: Vite matches a string
   * alias as a prefix, and `@` is a prefix of `@radix-ui`, `@tailwindcss` and
   * every other scoped package the handbook imports.
   */
  alias: [{ find: /^@\//, replacement: `${APP_SRC}/` }],
};

/**
 * Everything a build needs before it can compile a component of `apps/mobile`,
 * **in an order that is load-bearing and has no symptom when it is wrong.**
 *
 * `rnw()` is itself an array: flow-remove-types (the whole of what Rolldown
 * refuses outright), a JSX pass over `.js` files, `vite-plugin-commonjs`, the
 * React Native Web fixes, and `@vitejs/plugin-react`. The last of those is why
 * the site's config adds no React plugin of its own. `uniwind/vite` generates
 * the app's theme and its `.light`/`.dark` rules out of the stylesheet above.
 *
 * Both of them alias `react-native`, an alias list is searched first-match-first,
 * and the earlier plugin's entry is the one that survives the merge. Measured
 * both ways on 2026-09-11, on the built site, reading the drawn `Card` and
 * `Hairline` out of the DOM:
 *
 * | order | `Card`'s element | what it looks like |
 * |---|---|---|
 * | `rnw()`, then `uniwind()` | `css-g5y9jx rounded-md p-m bg-canvas border border-stroke` | correct, and follows the scheme |
 * | `uniwind()`, then `rnw()` | `css-g5y9jx` | **no ground, no border, no hairline at all** |
 *
 * With `react-native` pointing at `react-native-web`, `className` reaches the DOM
 * and the app's own stylesheet does the rest. Uniwind's components resolve a
 * `className` themselves instead, and in this bundle they resolve it to nothing.
 * The build is green either way, the measurement script reports 47 of 47 either
 * way, and the page renders either way — the components are simply unpainted,
 * which reads as a CSS problem and is a plugin-order one.
 *
 * `notADevApp()` is last, and that one is load-bearing too; see below.
 * `notHermes()` sits beside it and answers the same kind of question: which of
 * the app's startup assumptions are about a runtime this build does not have.
 */
export function appPlugins() {
  return [rnw(), uniwind({ cssEntryFile: APP_CSS_ENTRY }), notHermes(), notADevApp()];
}

/** `apps/mobile/src/i18n/polyfills.ts`, the one app module this build replaces. */
const HERMES_POLYFILLS = `${APP_SRC}/i18n/polyfills.ts`;

/**
 * The app's Hermes polyfills, left out of a build whose runtime is a browser.
 *
 * `i18n/polyfills.ts` installs the two `Intl` objects Hermes does not ship, and
 * it is conditional on purpose: `if (!('PluralRules' in Intl))`, so on iOS, on
 * web and in every browser since 2018 the branch is not taken and the `require`
 * calls inside it never run (ADR 0026 §6). The condition is a RUNTIME one, and
 * the two bundlers disagree about what to do with a `require` that a runtime
 * will never reach:
 *
 * | build | what it does with the three `require` calls |
 * |---|---|
 * | Metro | keeps them, bundles the modules, skips them at runtime — the trade the app wants |
 * | this one, production | hoists each to `import * as ns` and reads `(ns.default \|\| ns)` — three `IMPORT_IS_UNDEFINED` warnings, and it runs |
 * | this one, dev server | hoists each to a DEFAULT import — and `@formatjs/intl-pluralrules/locale-data/de.js` exports nothing at all |
 *
 * That last cell is a link-time `SyntaxError`, which takes down the whole module
 * graph before a line of it evaluates: `npm run handbook` served an empty `#root`
 * on every route while `npm run build:handbook` stayed green, for long enough that
 * two agents built themselves ways around it rather than reporting it (#160).
 *
 * So this build does not compile that module. It is not a polyfill it needs, the
 * app's source keeps the conditional exactly as measured, and the three warnings
 * the production build printed — documented in that file as "expected", which is
 * how a warning stops being read — go with it.
 *
 * `enforce: 'pre'` so the replacement is in place before `vite-plugin-commonjs`
 * sees the `require` calls, which is the transform that creates the import in the
 * first place.
 */
function notHermes() {
  return {
    name: 'handbook:not-hermes',
    enforce: 'pre',
    load(id) {
      if (id.split('?')[0] !== HERMES_POLYFILLS) return null;
      // A module, not nothing: `Localisation.tsx` imports it for its side effect
      // and an empty string is not a valid ES module to every consumer of this
      // hook.
      return 'export {};\n';
    },
  };
}

/**
 * `__DEV__` is false here even on the dev server, and this is not a detail.
 *
 * `vite-plugin-rnw` defines `__DEV__` from Vite's mode, which is what the app
 * wants and this site does not: the handbook is a React site that happens to
 * import a few of the app's components, and it has no Expo dev client, no Metro
 * and no dev menu behind them. Left true, `npm run handbook` served a **blank
 * page**: `lib/store/core.ts` reaches the store through `@/lib/theme`, its
 * `__DEV__` branch `require`s `redux-devtools-expo-dev-plugin`, and that came back
 * without a `.default` under Rolldown — `TypeError: devToolsEnhancer is not a
 * function`, thrown while the module was evaluating, so nothing rendered at all.
 * `expo-router` also opened Metro's `/hot` and `/message` sockets against this
 * server and failed. That debugger is `@rozenite/redux-devtools-plugin` now and
 * the `require` sits at module scope, so the shapes have changed; what has not is
 * why this define is here, which is that a Vite site has no dev client behind any
 * of it.
 *
 * A production build already defined it false, so the dev server was the odd one
 * out and the two now agree. The handbook's own code asks `import.meta.env.DEV`
 * and is unaffected; what the workbench reports about the *framed* app's
 * `__DEV__` is read across the frame boundary and is a different value entirely.
 *
 * Last in the list because a plugin's `config()` is merged in plugin order and
 * the last one wins.
 */
function notADevApp() {
  return {
    name: 'handbook:not-a-dev-app',
    config: () => ({
      define: { __DEV__: 'false' },
      /*
       * And again for the dependency optimizer, which has its own `define` and
       * does not read the one above. Without this, the pre-bundled `expo-router`
       * kept Metro's reload clients and opened `/hot` and `/message` from the
       * handbook's own page — which this server proxies straight to the app's dev
       * server, so with `npm run app` running as well they would have connected,
       * and Metro would have been sending the app's reload commands to the site
       * framing it.
       */
      optimizeDeps: { rolldownOptions: { transform: { define: { __DEV__: 'false' } } } },
    }),
  };
}
