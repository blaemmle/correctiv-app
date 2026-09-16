# ADR 0034 — A check that opens the page, because nobody forgot anything

Status: accepted, 2026-09-16. Built: `apps/handbook/scripts/renders.mjs`, both modes, in
CI. It is the first check in this repository that starts a browser.

## Context

`npm run handbook` served an empty `#root` on every route for a day while
`npm run build:handbook` was green, CI was green, and `npm run check` was green
([#160](https://github.com/faktenforum/correctiv-app/issues/160)). One file was compiled
twice and the two compilations disagreed: `apps/mobile/src/i18n/polyfills.ts` calls
`require()` inside a runtime condition, the production build hoisted that to a namespace
import and warned, and the dev server hoisted it to a **default** import of a module that
exports nothing, which is a link-time `SyntaxError` and takes the whole graph down before
a line of it evaluates.

Two agents hit the blank page the same day. Neither reported it. One served `dist`
statically, the other wrote an entry point importing a single page, and **both
workarounds worked**, which is worse than if they had failed: each agent got to look at
their own work, so nothing pushed either of them to ask why the normal way was dead.

[ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md) is the obvious place
to go for "make this fail", and walking its ladder produces nothing:

1. **A type error?** There is no closed set. The thing that must hold is "the page
   mounts", which is not a union anybody can name.
2. **Generate the type from the world?** Same answer. There is nothing to enumerate.
3. **Take the primitive away?** The primitive is a bundler, and there are two of them on
   purpose — Vite's dev transform and its production build. Removing the difference means
   removing the dev server.
4. **Read the source or the output?** This is the one that looks affordable and is the
   trap. The source is *identical* in both paths, and the output of the path that works
   is the only output there is — the broken path produces no artefact to read at all. A
   test asserting "no `require()` of an export-less ESM module under `apps/mobile/src`"
   would have caught this exact defect and nothing else, and it would have had to name
   the three modules, which is a list, which rots.

## Decision

**A check that starts each build path, opens the page in a headless browser, and fails if
`#root` is still empty**, printing what the browser said.

`apps/handbook/scripts/renders.mjs`, two modes.
`npm run handbook:renders` starts the dev server through Vite's own `createServer` with
this package's config, the way `npm run handbook` does.
`npm run handbook:renders:dist` serves `apps/handbook/dist` through
`screens/tools/serve-clean.mjs`. CI runs both, in the job that already builds the
handbook.

**This is not a fifth rung on ADR 0031's ladder.** That record is about *a thing that must
happen and nothing that makes not happening fail* — a component left out of an overview, a
German string outside the catalogue, an error code with no wording. Nobody forgot anything
here. The work was done, it was correct, and it did not run. No mechanism that reads a type
or a file can see that, and none of the four is weakened by this one existing; they answer
a different question. So ADR 0031 retires nothing and is not struck through anywhere.

**Affordable, measured on 2026-09-16**, one machine, warm npm cache:

| | cold (`node_modules/.vite` removed) | warm |
|---|---|---|
| `handbook:renders` (dev server) | 4.8 s | 2.7 s |
| `handbook:renders:dist` | 0.6 s | 0.6 s |

**Honest, in the two ways a check of this kind usually is not.** It fails rather than
skips when no browser is installed, because a check that passes on a machine without
Chrome passes on every machine where somebody needed it. And it was proved by breaking
it, three ways: the original defect (the `SyntaxError`), a throw at module scope — the
shape of the `devToolsEnhancer` incident `vite.app.mjs` records — and an entry script
served under a name nothing points at. The third is why the browser's own log is read
alongside its exceptions: without it the failure said "the browser reported no error"
about a 404.

**Not in `npm run check`.** That loop needs nothing but Node and is the thing people run
twenty times a day. This needs a browser, and its two modes together are a quarter of the
loop's whole duration for a class of defect that only a change to the handbook's build or
to a module it compiles out of `apps/mobile` can introduce.

## What was considered and not done

**Escalating the bundler's warning to an error.** `IMPORT_IS_UNDEFINED` is the production
build seeing the very same defect and shrugging; making it fatal would have caught #160 in
CI at the moment it landed, for about ten lines and no browser. Rejected because it is a
second net under the same hole — the check above already catches it, with the better
message — and because an absolute rule about one bundler diagnostic is a thing nobody owns
until the day an unrelated dependency trips it and somebody is blocked at four in the
afternoon. The condition it was guarding is now zero warnings, so a future one is visible
in the build log on its own.

**Rendering under jsdom or `ssrLoadModule` instead.** Neither reproduces the defect:
Vite's SSR transform proxies the namespace object and a missing `default` does not throw
there, and `react-native-web` in the handbook's tree needs a real document. A cheaper
harness that cannot see the failure is not a cheaper check.

## What this does not decide

**Whether the page is right.** It asserts that a shell mounted and that the body has
words in it. Every colour, every layout and every wrong string passes. That is
`/workbench`, a screenshot and a pair of eyes, and [AGENTS.md](../AGENTS.md#checks) says
so about the app already.

**Whether the app gets one.** The app's web export has its own assertions in CI and its
own failure history, and nothing here has measured whether opening `apps/mobile/dist` in
this same script would pay for itself. It is one argument to `renders.mjs` away if
somebody wants to find out.

**How many routes.** It opens `/`. That is enough only because the handbook's router
imports every page, so the module that broke it is reached from the landing page like any
other — and nothing makes a lazily imported route add its own line here. If one arrives,
this is the record to come back to.

## What it retires

Nothing. ADR 0031's four mechanisms stand exactly as written, and this decision is
deliberately outside them; the paragraph above says why.

One sentence elsewhere is now false and is corrected rather than struck, because it is a
comment and not a record: `apps/mobile/src/i18n/polyfills.ts` said that
`npm run build:handbook` prints three `IMPORT_IS_UNDEFINED` warnings and that they are
expected. The handbook no longer compiles that file, so it prints none — and "a warning
documented as expected" is how this defect stayed invisible in the one build path that
could see it.
