# ADR 0031 — What a check in this repository owes its reader

Status: accepted, 2026-09-16. Written after a day in which four of these were built or
repaired and each one independently arrived at the same four rules. The rules are the
part that would otherwise be lost: the checks stay, the reasoning that produced them
does not.

## Context

This repository leans on a kind of test that is unusual enough to need a record. It is
not a unit test and not an integration test. It reads the source, or the built
artefact, and asserts something about the codebase as a whole: that no German string
lives outside the catalogue, that the core imports no platform SDK, that no screen
reaches for a primitive colour, that every component is in the overview, that the dark
values sit where the native processor can read them.

They exist because
[AGENTS.md](../AGENTS.md#checks) says a green check proves nothing about how the app
looks or whether it runs, and because the corollary is worse: the defects that survive
a green build are exactly the ones no ordinary test is shaped to catch. On 2026-09-15
that list included a share button that had been dead on every desktop browser, a tab
bar that could have had two tabs called "Home", a deploy check that printed "OK" when
its directory was missing, and a dark mode that had never worked on a phone.

Six of these checks now exist. That is enough for their shape to matter more than any
one of them, and enough for the failure mode to be visible: a check of this kind is a
list of exceptions, and a list of exceptions is a thing people widen.

## Decision

Four rules. Each was arrived at twice on the same day, by different people working on
different checks, which is the only reason to write them down rather than leave them
to taste.

### 1. An exception carries its reason, not just its path

`apps/mobile/__tests__/localisation-seam.test.ts` began as thirty-six entries under a
constant called `NOT_YET_MIGRATED`. It was honest and it was unreadable: thirty-six
paths say nothing about which of them is a temporary debt and which is a permanent
fact. It is two entries now, and the constant is called
`GERMAN_OUTSIDE_THE_CATALOGUE`, and each carries the argument for why it is there — a
channel's name is a mark, so a descriptor's `defaultMessage` would be the German
spelling and would sit in the same file either way; the recovery screen is rendered BY
the error boundary, so the provider is inside the subtree being caught, which was
measured rather than assumed.

The word for the list changed with it. Thirty-six entries want the words "not yet".
Two want the word "because". **A third arriving without a reason is the thing to argue
about**, and that sentence is in the file rather than in this one.

### 2. A check says what it cannot see, at itself

Every one of these is a partial net, and every one of them looks total from outside.
The umlaut net does not see "Suchen". The colour check does not see `colors.white`
reached by dot access, a class assembled at runtime, or a hex literal in a `style`
prop. The component check holds names against files and says nothing about whether an
entry shows anything.

So the limits are written beside the assertions, in the file, where somebody reaching
for a bypass will meet them. Not in a document, because a document is not where that
person is looking.

This is not modesty. On 2026-09-16 the seam check was extended to the core, and the
review found German already shipping in the very file the change rewrote —
`'● LIVE · 24/7 aus Bottrop'`, which has no umlaut and which the net therefore could
not see. The limit had been named the day before. Naming it is what made it findable.

### 3. A check that cannot fail is deleted

Two were written and removed on the day this record was made. One asserted a cascade
property that held against the broken stylesheet and the fixed one alike. One asserted
a `rounded-s` collision that could not arise on the path the test took.

AGENTS.md already says "a rule nobody can break is noise beside the ones they can".
The operational form of that is stronger: **every one of these is proved by breaking
it.** Write the violation, watch the suite stay green, apply the check, watch it fail,
restore, and put the failure message in the commit. A check whose failure message has
never been read is a check nobody can act on.

The message matters as much as the failure. `app/atlas.tsx: grey-500 ×3, excused ×1`
tells somebody what to do. It reported the wrong line numbers for a while, in every
file, because the helper that strips comments removed their newlines before the source
was split — which is the same class of fault as the check being absent, and was found
by a reviewer rather than by the check.

### 4. A ratchet is a debt, not a state

A list asserted in both directions, so that a new violation fails and a repaired one
fails too, is the right tool when the end state is far away. It is also a tool that
rots pleasantly: it goes green every day while the number stands still.

So a ratchet is written to shrink. The localisation one went from thirty-six to two in
a day. The deprecated-colour one stands at thirty-four and says so. When a ratchet
stops shrinking for long enough that nobody remembers what it was for, the honest
answers are to finish it or to admit it is a permanent exception and write the reason —
never to leave it half-named.

## What this does not decide

**Whether to write one.** These are expensive. Each of the six cost between forty and
two hundred lines and an argument, and the argument is the part that does not scale.
The test for whether one is worth building is the one AGENTS.md already gives for a
document: can it fail? If not, do not write it. A check is not a place to put an
intention.

**How many is too many.** Six is affordable. The tax is not the running time — it is
that each list has an owner, and a list nobody owns gets widened by whoever is blocked
by it at four in the afternoon. There is no rule here for that yet, and inventing one
before it hurts would be the same mistake this record warns about.

## What it retires

Nothing. AGENTS.md's Checks section stands and this is the reasoning underneath it;
its "Facts that expire" section stands and rule 3 here is the same argument applied to
tests rather than to figures.
