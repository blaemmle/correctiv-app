# CORRECTIV App, agent rules

Only what you cannot read off the code. Follow the links; do not restate them here.

- [ARCHITECTURE.md](ARCHITECTURE.md), core, ports, colour, where things live
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md), the traps, and **why a green check is not evidence**
- [adr/](adr/README.md), the decisions, and which of their claims have expired
- [SOURCES.md](SOURCES.md), every source the app reads, measured, beside the ones the
  scope asks for and nobody has named yet

## Where code goes

Behaviour goes in `packages/app-core`. The app holds screens, its store binding and
one file implementing the ports. Ask whether what you are writing is a screen; if
not, it belongs in the core. That the app is currently the only host is not a reason
to relax this, because the core is what survived the last change of view layer. The
core imports no UI framework and no platform SDK, so needing a platform means
declaring a port, not widening an allow-list. Derived state is an exported selector
taking state, never a store method.
([ADR 0006](adr/0006-one-core-two-hosts.md))

`apps/mobile` is the app. Its web export is published on every push to `main`, so
anything that lands there is public.

`apps/handbook` is the published site: the documentation, the source inventory, the
diagrams, the core's reference, and the app in a device frame at `/workbench`. It
reads the repository's Markdown in place and holds no copy of any document, which is
the rule to keep: a second copy of `ARCHITECTURE.md` would be the one on the website
and the one nobody edits.

The device frame reaches into the app by same-origin property access, so the two
halves have to be one origin. The Pages deploy assembles them into one artifact and
the dev server proxies `/app`; do not give the handbook a second origin, because the
browser refuses those property reads silently.
([ADR 0014](adr/0014-the-preview-shell-as-a-package.md),
[ADR 0024](adr/0024-the-handbook-owns-the-root.md))

`tools/` is the third place, for what is neither a host nor a library the app ships:
`tools/figma-plugin` is what is left there.

Colours come from classes (`bg-canvas`), which follow the appearance setting on their
own. Reading a colour in TypeScript needs `useColors()`, or it is pinned to light.

Reach for a **semantic** token: `canvas`, `surface`, `on-canvas`, `on-canvas-muted`,
`stroke`, `accent`. Those follow the scheme.

The primitives behind them — `white`, `black`, `neutral-100…700`, `red-500`,
`yellow-400` — do **not**, and nothing stops you writing `bg-white` where you meant
`bg-canvas`. That is a white page on a dark phone, and no check catches it. Use one
only where a colour must not follow the scheme: text on the brand red, a label on club
yellow, a fill on a photograph. In `apps/mobile` that case is still spelled
`always-light` / `always-dark`, which is what all 49 existing call sites use — a line
of `apps/mobile/src` outside a comment that writes one of the two names, which is the
count a rename pass would have to make, and `apps/mobile/__tests__/tokens.test.ts`
takes it so this sentence cannot drift off the code again. They are the older names
for `white` and `neutral-700` and ADR 0022 retires them, so prefer them there until
it does rather than mixing both spellings.

**Not in the core.** `always-light` and `always-dark` are this app's invention, so they
are absent from `tokens/theme.css` and therefore from the `--var-color-*` block the
article reader's WebView gets. `packages/app-core` has to use the primitives —
`var(--var-color-white)`, `var(--var-color-neutral-700)` — and a rule written with
`var(--var-color-always-light)` there is simply undefined in light mode. Both spellings
in the repo is that boundary, not an inconsistency to tidy.

`grey-100…700`, `emphasis` and `alternative` still resolve; they are upstream's
deprecated tier and nothing new should use one. Three app uses have no successor yet
and are listed in the ADR.
([ADR 0022](adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md))

## Decisions

`adr/` records **why**, not what. Add one when a choice would otherwise have to be
argued from scratch later: a dependency swapped, a boundary moved, a capability
measured and rejected. Not for ordinary work, and not for anything the code already
says.

**Keep them current, and only where it matters.** An ADR is a record, so it is never
rewritten to look right in hindsight. The reasoning is the part worth having, even
when the conclusion has moved on. When a later decision voids a claim in an earlier
one, strike that claim through where it stands, add one clause saying what voided it,
and link the ADR that did. Leave the argument around it intact. The newer ADR carries
a section naming every statement it retires, so the two halves cannot drift apart.

Do not strike through a claim that is merely old. Only one that is now **false**,
where someone reading it would act on it and be wrong.

## Facts that expire

A figure measured against the outside world goes wrong quietly, and no reviewer
catches it because nothing about it looks wrong. A figure measured against **this
repository** goes wrong the same way, and faster. Three such facts exist here:

- The measuring day, in `SOURCES.md` and in `apps/handbook/content/sources.manifest.ts`.
  Re-measuring means editing both, so a test fails when the two dates part, and the
  board prints the age beside the date, worked out in the reader's browser, because a
  published page sits at its address for months.
- A claim and the record that voided it, which is the pair above.
- The count of `always-light` / `always-dark` call sites, in the colour section above.
  It was exact when ADR 0022 typed it, four short a week later, and nothing failed.
  `apps/mobile/__tests__/tokens.test.ts` takes it from the source and holds this file
  to it, so it is one number in one place with a check under it.

Add the check with the fact, not afterwards. Where a check is genuinely not possible,
keep the number in one document and have the others point at it — the time
`npm run check` takes is measured in `ARCHITECTURE.md` and nowhere else for that
reason. That is the weaker arrangement and it is worth knowing why: a pointer stops
two copies parting, and nothing about it stops the one copy going stale. A figure that
depends on the machine it was measured on should be read as a bound, not a reading. "Keep the
documentation current" is not a rule that belongs here: it cannot fail, so nothing
enforces it, and a rule nobody can break is noise beside the ones they can.

## Language

English for everything a developer reads: code, comments, test names, CLI output,
commits, `.md`. The codebase is fully English as of 2026-08-12, so a German comment
now is a regression, not a leftover.

**The source a user reads is English too, and the German is data.** Every
user-facing string is a message descriptor — `defineMessages({ id, defaultMessage })`
in one obvious place per screen, not interpolated through the markup — and its
`defaultMessage` is English. That place is called `COPY`, one per file; a block
another file imports takes the name of what it belongs to (`HEADER_COPY`), because
the importer has a `COPY` of its own, and a `Record` of labels for a domain's values
is named for the domain (`TIER_LABELS`) rather than folded into the copy. The German,
formal *Sie*, lives in
`apps/mobile/src/i18n/catalogue/de/`, one file per id namespace, and that directory
is the only place under `apps/mobile/src` where a German character may be written.
German is the only language that ships: the locale is a fixed value in the core's
settings slice, and a switch for it belongs in the workbench rather than in the app.
`apps/mobile/__tests__/localisation-seam.test.ts` is what enforces this. Two German
strings are exempt and it names each one, not the file it sits in, with the reason: a
channel's own name, and the recovery screen's lead, which cannot be a message because
that screen is rendered BY the error boundary, so the provider is inside the subtree
being caught. A third exemption arriving without a reason is the thing to argue about.
([ADR 0026](adr/0026-react-native-review-and-hardening.md) §6)

**A pull request is the exception, and German is the rule there.** Its title and body
are an argument with the team about work that has not landed, and the people having
that argument speak German. The line is the merge: what goes into the repository is
English, what is said about it on the way in is not. A commit message is on the
English side of that line, because it stays.

German typography, not English, wherever German is written, a pull request included:
quotation marks are „…“, and the em dash does not appear at all. Where a sentence
wants a break, use a comma or a full stop; the Halbgeviertstrich – belongs only where
neither will do. English prose quoting a German label takes straight quotes on both
sides, and a German sentence leaves an identifier, a path and a command in their own
spelling.

## Checks

`npm run check` at the root: typecheck, oxlint, oxfmt, tests. How long it takes is
measured in [ARCHITECTURE.md](ARCHITECTURE.md) and is deliberately not repeated here,
because a duration typed in two places is two facts and one of them goes wrong on its
own. Do not introduce eslint or prettier.

**A green check proves nothing about how the app looks or whether it runs.** After a
route, a bundle config or a platform split, run `npm run build:web`, then
`node screens/tools/serve-clean.mjs apps/mobile/dist 8099` and open it. A plain
static server maps no clean URLs and makes a working app look broken. After layout,
screenshot it and look (`screens/tools/tour-android.sh`, compared against
`screens/`), or open `/workbench`, which frames the web target at a phone or
tablet size and carries device, route, appearance and app state in its URL. Anything
touching colour has to be seen in **both** appearance settings *and* with the setting
on "System" against a dark device. That last combination is the app's default and is
the one that has already shipped broken.

**A picture that decided something goes into the pull request or the issue**, not only
into the working directory. `screens/evidence/` is where it lives and
[screens/README.md](screens/README.md) has the addressing rule, which is not obvious:
a body renders no repository path, so it needs a raw address pinned to a commit.
