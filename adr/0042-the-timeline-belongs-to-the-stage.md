# ADR 0042 — The timeline belongs to the stage, not the tools

Status: accepted, 2026-09-17, from the design interview held after the architecture
meeting in [#200](https://github.com/correctiv/correctiv-app/issues/200). **Not built.**

## Context

[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §10 put the day on a track —
the hours, the moments as stops, the machine's own clock as a mark, and a playhead — and
built it inside the `home` tool, which is one of the tools the rail at `/preview` opens
([ADR 0038](0038-one-tool-at-a-time-in-a-rail.md)). It works. It is in the wrong place, and
the reason is not that it is cramped, although it is.

The panel is declared at 31% of the window, which 0038's own "What it costs" section says
is a width chosen for the widest tool — the console and the token list. A day is
twenty-four hours laid end to end. At 1440px that is a track about 440px wide, so an hour
is eighteen pixels and a moment's label does not fit beside the moment it labels. The
track was designed into the width it was given.

But cramped is the third reason, and leading with it would produce the wrong change: it
would produce a wider panel.

## Decision

### 1. The timeline sits below the framed app, in the stage

Not in the panel. Below the frame, full width, opposite the toolbar above it — the
`context-bar` that carries device, orientation, zoom and route.

**Because it is not a tool.** That is the whole of the first reason and it is the real one.
The controls above the frame say *what you are looking at*: which device, which way up,
how big, which route. The controls in the rail *inspect what is on the stage*: what the
console said, which token a colour came from, what the element under the pointer is. The
hour is the first kind. A route and an hour are the same sort of fact about the thing being
shown, and the only reason they were ever in different halves of the screen is that one of
them arrived with an editor attached.

**Because it is useful to somebody who is only looking.** ADR 0038 §2 decided that nothing
opens by default, so that a person who follows the link in `README.md` meets the app and
not a debug surface. That decision is right and it is exactly why the hour cannot live
behind the rail: showing somebody the home screen in the evening is a demo, not an
inspection, and it should not require finding a rail, choosing a tool and reading an editor.

**Because full width is the room it needs.** Twenty-four hours across 1440px is an hour per
sixty pixels, and the moments can carry their times.

### 2. Drawn where the document governs the route, and nowhere else

The home screen today, and nothing else. On `/artikel` the hour changes nothing: the
document does not describe that screen, so a playhead there would move and the app would
not. A control that demonstrably does nothing is the kind of quiet lie this repository
spends its checks on, and ADR 0038 §5 already cut six badges for saying less than that.

What decides it is **the route the frame is showing**, which `preview/store.ts` reads back
live, not the route field somebody is halfway through typing.

A switch in the toolbar puts it away, for the same reason the chrome has one: somebody
looking at the home screen at its real hour should be able to have the frame and nothing
else.

Where a control is dead rather than absent, it says why, which is the pattern
[ADR 0025](0025-the-published-app-is-a-production-bundle.md) established for the published
build reporting "no dev handle" and 0038 §5 kept for the two `NeedsDev` cards. Absent and
honest beats present and inert.

### 3. Looking never changes anything

**Without the `home` tool open**, the timeline moves the playhead and jumps between
moments. That is all it does, and it is enough for the demo, the screenshot and the
argument about whether the evening reads well.

**Adding a point, moving one and deleting one need the tool**, because those are moments
and moments are the document. The line is not "advanced versus simple", it is **reading the
document versus writing it**: the stage's controls select between states the document
already describes, and the panel's controls change which states there are. That is the same
line `apps/mobile/src/lib/home/clock.ts` already draws about its own key, in as many words
— the simulated hour "selects between states the document already describes and cannot
introduce one", which is strictly less power than the document override next door.

It also protects a decision ADR 0039 §10 already took. A new moment is an explicit act
rather than a side effect of editing at a time where none exists, so that a playhead nudged
by a minute and a control toggled twice does not leave two moments a minute apart. Put the
playhead on the stage, where anybody will drag it, and that argument gets stronger rather
than weaker: a track everyone can touch must not be able to create a moment by being
touched.

What looking does write is the address — `tm=18:30`, by
[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §9 — and that is the point of
it. A view of the home screen at half past six is a thing to send somebody.

### 4. Below 1024 it folds onto one line, and the order down the screen never changes

Frame, then timeline, then the tools. At every width.

Below 1024 the timeline lies between the frame and the tool row, folded onto one line:
playhead, time, and the moments as unlabelled points. The labels are what does not fit; the
track itself is one-dimensional and fits anywhere.

Keeping the order is the part worth stating. ADR 0038 §4 put the rail along the bottom and
the panel above it with the page still on screen, and the reason it is one narrow layout
rather than two is that a reader should not have to learn a second arrangement. The
timeline joins the page's half of that layout, so it changes where a thing is and not what
order things come in.

## Why not the alternatives

**Leave it in the tool and widen the panel.** ADR 0038 measured this: 55% is the most the
resizable group allows, and at 55% of 1440 the app is in a 600px column. That trades the
thing being previewed for the thing previewing it, which is the trade that record exists to
refuse.

**A time field in the toolbar, beside the route.** It fits, it costs nothing, and it loses
the day. A field shows one number; a track shows where the moments are, which is the only
way to see that a document has three of them and that two are in the morning. It is also
what the tool had before ADR 0039 §10 drew a track, so it is a known quantity: it was
replaced.

**A tool of its own in the rail, called Timeline.** The panel is one-of-N by ADR 0038 §1,
so opening the timeline would shut whatever else was open — and the timeline is the control
you want *while* using another tool. One-of-N is right for inspectors and wrong for a
setting.

**Floating over the frame.** Covers the app. The app is the thing.

## What it costs

**The stage's height is no longer the frame's height.** A phone at 100% on a short window
plus a track is taller than the viewport, so either the page scrolls or "Fit" fits a
smaller box — which means the same address draws the app slightly smaller than it does
today, on the same window. Real, accepted, and worth knowing before somebody compares two
screenshots taken either side of this change.

**One state, two drawings.** The stage's playhead and the tool's are the same minute, and
if they are ever two pieces of state they will disagree in front of somebody. ADR 0038 §1
met the neighbouring version of this — a tool unmounting took its slot target with it, and
the console's filter reset every time somebody looked at something else — and the answer
there was to keep everything mounted. The answer here is that the minute lives where it
already lives, in the frame's state and in the address, and both drawings read it.

**A control that is not on every route is a control somebody will not find.** Arrive on
`/artikel`, and nothing on screen says the hour is adjustable anywhere. What stands against
that is the address: `tm=` travels in a link, so the way somebody meets this feature is
usually somebody else's link, and that is also how the device and the appearance are met.

## What is still open

**Which routes the document governs, beyond the home screen.** One today. When a second
screen becomes a document, "does the document govern this route" has to be answered by the
document rather than by a list in the shell, or the list is a third copy of a fact
[ADR 0036](0036-the-home-screen-becomes-data.md) §14 spent a decision making singular. Not
designed here because there is no second screen.

**Whether the timeline survives `full`.** Below 1024 `/preview` arrives with the chrome out
of the way, because the app is what the link was for (ADR 0038 §4, `fullWhenNarrow`). §1
above says the timeline is a setting of what you are looking at, like the device — and the
device controls are chrome and do go away. So the honest position is that this record does
not say whether the timeline is chrome, and somebody building it has to choose. The
question has a right answer and it depends on what a `full` link is for, which nobody has
written down.

## What this retires

**Nothing is struck, and [ADR 0038](0038-one-tool-at-a-time-in-a-rail.md) was read in full
for it.** Three of its decisions were candidates and all three stand.

- **ADR 0038 §6, "Every view with a panel gets the rail … One mechanism, not two."** Read
  and deliberately not struck. That decision is about **how a panel is opened**, and it
  refuses a second switch for the same panel. The timeline opens no panel and switches
  nothing; it is a control on the page, the way the device selector above the frame is.
  Struck, it would read as though the rail had stopped being the only way into the panel,
  which is not what changed.
- **ADR 0038 §4, the one narrow layout.** Narrower than it was, not false. Page above,
  panel, rail along the bottom is exactly what it says and exactly what remains; the
  timeline joins the page's half. Its own observation — there is no width to divide at
  390px — is what §4 above starts from.
- **ADR 0038 §2, "Nothing is open by default, on any view."** Untouched. The timeline is
  not a tool and drawing it is not a panel opening. If anything this record leans on it:
  the hour had to leave the panel *because* nothing in the panel opens by itself.

**[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §10's first sentence becomes
false the day this lands, and is not struck yet.** "The panel draws the day as a track"
describes the tree as it is today and will describe nothing once the track is in the stage.
The strike belongs to the change that moves it, with a clause and a link to this record —
the same shape [ADR 0033](0033-one-text-size-for-the-whole-app-the-systems-by-default.md)
used for a sentence that becomes false the day its decision lands, and the reason for
waiting is that a strike on a claim which is still true would be a record rewritten to look
right in advance. The rest of ADR 0039 §10 is unaffected wherever the track is drawn: an
edit lands on the point in effect, a new moment is an explicit act, and the editor never
writes a change equal to what the point already inherits.
