# ADR 0030 — The platform's header on the phone, and ours on web

Status: accepted, 2026-09-14. **The native half is unrun.** No Android emulator and no
iOS device were available for this change, so the part it exists for has been seen by
nobody. What was verified is the web target, in three appearance combinations. See the
last two sections.

## Context

[ADR 0026](0026-react-native-review-and-hardening.md) section 9 decided the shape and
left three details open. This record carries them out and answers the three.

The argument is [ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md)'s, one
level up. A drawn tab bar imitated the system's appearance and then stopped; a drawn
header does the same thing with a smaller surface. What it cannot imitate is the
back gesture, the long-press on the back control that shows the stack, a title that
grows with the system font size, the large-title collapse on iOS, and press feedback
that belongs to the platform rather than to us. None of that survives being redrawn,
and none of it has to be written if it is not.

## Decision

**The platform's stack header on iOS and Android, configured; the app's drawn bar on
web.** One seam, `components/ui/ScreenHeader`, with `ScreenHeader.tsx` setting
`<Stack.Screen options>` and `ScreenHeader.web.tsx` drawing the bar, and one shared
props type, `screenHeaderTypes.ts`, so the two cannot drift apart. That is the
repository's existing platform-split pattern (`components/reader/`,
`components/media/`), and `__tests__/web-target.test.ts` now guards this pair the same
way it guards those.

**Web keeps the bar because nothing else draws one there.** This was measured again
against the installed `react-native-screens` 4.26.2:
`lib/module/components/ScreenStackHeaderConfig.web.js` is eleven lines, and every
export in it — the config, the left, centre, right and search subviews, the subview
base — is a bare `View`. `SearchBar.web.js` is `const SearchBar = View`. The one
exception proves the rest: the back-button image is a real `Image`, with no bar to sit
in and nothing that positions it. So on web this is not a preference between two good
options. It is the only half that draws anything.

**The drawn bar is its own file**, `components/ui/ScreenHeaderBar.tsx`, byte-identical
in its render to what `ScreenHeader` was. Three things render it — the web half of the
seam, the two named exceptions below, and the gallery — and a bar drawn in three places
would have been three bars within a release. The gallery keeps listing it under
`ScreenHeader`, because on web that is exactly what `ScreenHeader` draws, and because
that name is already the address `tools/figma-plugin` and the handbook use for it.

## The two exceptions, named so they are a decision

**`/suche` keeps the drawn bar on every platform.** The native alternative is
`headerSearchBarOptions`, and it is a different interaction on each platform: on
Android the field collapses into an icon and takes the header over when it opens. This
screen owns two heterogeneous result sections and three empty states whose behaviour is
bound to the field it has — too short, searching, nothing found — and adopting the
platform's field means redesigning all of that. This change is not the place to also
redesign search.

**`/formular` keeps it too**, for the reason ADR 0026 predicted. Its
`backLabel="Abbrechen"` exists so that two controls called „Zurück“ cannot mean two
things — the header's and the step-back button in the footer. `headerBackTitle` is
iOS-only; an Android stack header shows no back title at all, so on Android the label
would simply not exist and the two controls would collide again. Both of the route's
call sites keep the bar, not only the one with the label: a route that swapped header
kinds between its "not found" state and its form would be one route with two chromes.

Both exceptions are declared at the call site, not inferred. `ScreenHeaderProps` is a
union: `backLabel` and `children` typecheck only together with `drawnBar`, so a
fourteenth screen cannot pass a prop the platform's header would silently drop.

## The titles, and what was actually wrong

Fifteen route files use `ScreenHeader`, at sixteen call sites (`/formular` has two, one
per state). Fourteen of the sixteen passed nothing at all before this change, which is
the figure ADR 0026 predicted. After it, thirteen pass a title and nothing else, and
three — the two in `/formular` and the one in `/suche` — pass a title and `drawnBar`.
So thirteen call sites take the platform's header and three keep ours.

`onBack` turned out to have **no caller in the app at all** — the gallery was the only
thing that ever passed it. It is gone from the seam and stays on the bar, because the
native header's back control is the platform's and a prop the seam could not honour
would be exactly the silent defect this change is meant to remove.

| Route | Title |
| --- | --- |
| `/atlas` | Abriss-Atlas |
| `/aufruf/[slug]` | Mitmach-Aufruf |
| `/backstage` | Backstage |
| `/behauptung/[id]` | Behauptung |
| `/bericht` | Quartalsbericht |
| `/einstellungen` | Einstellungen |
| `/faktenforum` | Faktenforum |
| `/formular` | Mitmach-Formular |
| `/gespeichert` | Gespeicherte Artikel |
| `/projekt/[id]` | Projekt |
| `/serie/[id]` | Podcast-Serie |
| `/spotlight` | Spotlight |
| `/suche` | Suche |
| `/tagebuch/[id]` | Recherchetagebuch |
| `/video` | Video |

Each one is the word the screen already uses: `/behauptung` says „Diese Behauptung gibt
es nicht“, `/serie` says „Diese Serie gibt es nicht“ over a Podcasts section, `/bericht`
prints „Quartalsbericht 1/2026“ as its headline. A synonym would have been a second
name for the same thing.

**ADR 0026 said the pushed routes share one browser-tab title. They do not — they have
none**, and the reason is worth writing down because it changes what the fix is.
Measured on 2026-09-14 against expo-router 57.0.19:

- `expo-router/build/ExpoRoot.js` hands its `NavigationContainer` a hard-coded
  `documentTitle: { enabled: false }`. react-navigation's own bridge from
  `options.title` to `document.title` is therefore off, and setting the option alone
  changes nothing in a browser. Verified by setting it and looking.
- `expo-router/head` is the path that leaves open, and it needs a `HelmetProvider` the
  app does not mount. Verified the same way: a `<Head><title>` in a route also changed
  nothing.
- Neither reaches the static export either, and not because of the two above. The root
  shell renders `null` until the fonts are loaded and the store is hydrated, so
  `expo export` renders **no screen at all** — `grep -c "Abriss-Atlas" dist/atlas.html`
  returned 0 before this change, and every page ships
  `<title data-rh="true"></title>`.

So the title is set by hand, in `ScreenHeader.web.tsx`, and the previous one is restored
on unmount. That is what makes a stack behave: pushing remembers what was there, popping
puts it back. It lives in the header rather than in the root layout because the header
is mounted exactly as long as the screen is.

## The back control does not route through `goBack`, and the floor stays

The native header's back control is `react-native-screens`', wired to the navigator.
`lib/navigation/goBack.ts` is not in that path. Whether the floor under
`app/_layout.tsx`'s anchor is still needed **was not settled on a device**, because
there was none.

It is still needed regardless, and that much is settled: the drawn bar routes through
`goBack`, and the drawn bar is what the whole web target and the two named exceptions
use. On the web target the floor was exercised — `/gespeichert` opened cold, with no
history behind it, and its back control landed on `/` rather than doing nothing. So
`goBack` is untouched by this change and cannot be removed by the check the issue asks
for; what that check can still decide is whether the *native* arrow ever reaches a dead
end the anchor does not cover, which is a question about one platform rather than about
the function.

## What it costs

**The header is now the platform's type, not the app's.** Only its colours are
configured, from `useColors()`, the same line ADR 0013 drew for the tab bar: the shape
and the typography are the platform's. A brand that ends at the header's edge is the
trade, and it is the trade that decision already made one level down.

**`headerBackTitle` is set to „Zurück“ rather than inherited.** iOS's default back title
is the previous route's title, and until this change no route in this app had one; a
tab root still has none, so the control could have read whatever the router calls it.
Stating it is one line and removes a whole class of surprise. On Android it is inert.

**A title appears one layout effect after the screen mounts**, because
`<Stack.Screen options>` is `navigation.setOptions` under the hood. Whether that is
visible on a device is one of the things nobody has looked at.

**Four test suites now mock `Stack.Screen`.** A screen with a header reaches
expo-router for more than `router` now, and the suites that render one say so.

## What this retires

**One paragraph in `components/ui/ScreenHeader.tsx`**, half of it. The sentence
"Deliberately NOT a native stack header — the app sets `headerShown: false` throughout
and builds its own bars, so that iOS, Android and web show the same brand" is struck
where it stands and names this ADR as what voided it. The rest of that paragraph —
"A native header looks different on every platform, and on web it does not appear at
all" — is left standing, because it is still true, was re-measured above, and is the
reason the web half exists. This is the strike ADR 0026 named in advance and deferred
until the code changed.

**One line of `ARCHITECTURE.md`**, corrected rather than struck, because it is a living
document: the platform splits are three now, not two.

Nothing in another ADR. ADR 0026 section 9 is carried out rather than superseded, and
its three open details are answered above; its own claim that the pushed routes "share
one browser-tab title" is the one statement of it this record corrects, and it is
corrected in the paragraph above rather than struck, because the conclusion it drew
from it — that titles have to be written — was right.

## What this has not delivered

**Nothing native was run.** No emulator, no device, no simulator. Every claim above
about how the header looks on iOS or on Android is read off the API and off ADR 0013's
precedent, not off a screen. The specific things a device pass has to answer:

- that the header appears at all on both platforms, with `headerShown` set from inside
  the page rather than from the layout;
- that `canvas` and `on-canvas` reach it, in both appearance settings and with the
  setting on "System" against a dark device;
- that „Zurück“ shows on iOS and that Android's header is not the worse for having no
  back title;
- that nothing flashes between mount and the first layout effect;
- and the ten-minute check the issue asks for: `correctiv://gespeichert` and the native
  arrow, against `goBack`.

ADR 0013 shipped with a warning of exactly this shape and the emulator round then found
two faults, both in the half nobody had run. This warning should be read the same way.

**The web target was verified, and only it.** `npm run build:web`, served through
`screens/tools/serve-clean.mjs`, at 540×1200, on 2026-09-14: eight pushed routes, eight
distinct browser-tab titles, the drawn bar unchanged, in all three appearance
combinations — setting "Hell", setting "Dunkel", and setting "System" against a device
reporting `prefers-color-scheme: dark`, which is the app's default and the combination
that has shipped broken before. The dark shots measure `srgb(26,26,26)`, which is the
dark `canvas` token, at the bar and at the page.

**The five tab roots still have no title,** and neither does the app's own entry page:
they have no `ScreenHeader`, so nothing in this change reaches them. `/` therefore still
shows its address in the browser tab, and going back from a pushed route restores that
emptiness rather than a name. Giving the tabs and the root a title is a separate,
smaller change.

**A keyboard offset was not implemented.** A native stack header has a height, and a
`KeyboardAvoidingView` under one has to account for it through `useHeaderHeight()` from
`@react-navigation/elements`. The two screens with inputs are the two exceptions and
keep the drawn bar, so this does not arise today; it arises for the first screen with
an input that takes the platform's header.
