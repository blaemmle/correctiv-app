import { cn } from '../lib/cn';

/*
 * The drawings' vocabulary, which used to be a stylesheet.
 *
 * Tailwind utilities work on SVG elements, so `fill-canvas` and `stroke-stroke`
 * say on a `rect` what they say on a `div`, and both read the same token the app
 * reads. What a plain utility cannot say is that eighteen chips are one thing, so
 * each visual role keeps its name here. A role named once is a role that cannot
 * drift across three diagrams, which is the whole reason the deleted sheet had
 * these names.
 *
 * Every one of them is a token, never a literal. That is what makes the drawings
 * follow the light and dark schemes with no second asset to keep in step, and
 * `test/styles.test.ts` fails the build on a colour value written here.
 */

/** A container, filled with the ground so a line behind it is knocked out. */
export const BOX = 'fill-canvas stroke-stroke';
/** The core's own frame, which is the one box that outranks the boxes near it. */
export const BOX_CORE = 'fill-canvas stroke-stroke-strong [stroke-width:1.5]';
/** A labelled block sitting on the ground, one step up from it. */
export const CHIP = 'fill-surface stroke-stroke';
/** A port, drawn as a contract rather than a block, so it takes the accent. */
export const CHIP_PORT = 'fill-canvas stroke-accent [stroke-width:1.5]';
export const CARD = 'fill-surface stroke-stroke';
/** The adapter band, which is a fill and no outline because a rule sits under it. */
export const BAND = 'fill-surface stroke-none';
export const CALLOUT = 'fill-surface stroke-stroke';
/** A grouping frame, dashed because it encloses without being a thing itself. */
export const DASHED = 'fill-none stroke-stroke-strong [stroke-dasharray:6_5]';
/** A dependency the package may not have, drawn as an absence. */
export const GHOST = 'fill-canvas stroke-stroke [stroke-dasharray:4_3]';

export const RULE = 'stroke-stroke';
export const RULE_STRONG = 'stroke-stroke-strong';
export const AXIS = 'stroke-stroke';
export const WIRE = 'fill-none stroke-on-canvas-muted [stroke-width:1.5]';
export const LEAD = 'stroke-stroke';
/** The line nothing crosses, and the figcaption below calls it the red line. */
export const BOUNDARY = 'stroke-accent stroke-2';
/** An amendment a record makes to an earlier one, stated in the record itself. */
export const ARC = 'fill-none stroke-on-canvas-muted';
/** The same relation, but recorded only in the index, so it is drawn as weaker. */
export const ARC_INDEX = 'fill-none stroke-stroke-strong [stroke-dasharray:2_3]';
/** A correction to a living document, which is rewritten rather than annotated. */
export const ARC_DOC = 'fill-none stroke-on-canvas-muted [stroke-dasharray:6_4]';
/*
 * The arrowheads. A marker does not inherit from the line that references it, it
 * inherits from where it is defined, so each one carries its own fill and the
 * two of them match the two weights of arc above.
 */
export const MARKER = 'fill-on-canvas-muted stroke-none';
export const MARKER_LIGHT = 'fill-stroke-strong stroke-none';
export const HATCH = 'stroke-stroke';

/** A record with nothing recorded against it, drawn small on the axis. */
export const NODE_QUIET = 'fill-stroke-strong stroke-none';
export const NODE_INTACT = 'fill-canvas stroke-on-canvas-muted [stroke-width:1.5]';
/** Accepted, with claims struck in place. Club yellow, which both schemes share. */
export const NODE_STRUCK = 'fill-accent-alternative stroke-stroke-strong';
/** Moot, so the ring is broken rather than merely pale. */
export const NODE_MOOT = 'fill-surface stroke-stroke-strong [stroke-dasharray:2_2]';

/*
 * Type, in the drawing's own units.
 *
 * These are the one place the theme's named steps are the wrong tool. A step is
 * in rem, which does not scale with the viewBox, so a label set in `text-s` would
 * hold still while the drawing around it grew. Inside an SVG a size in px is a
 * size in user units, and the drawings were laid out against these four.
 */
export const T11 = 'text-[11px]';
export const T12 = 'text-[12px]';
export const T13 = 'text-[13px]';
export const T16 = 'text-[16px]';
export const MONO = 'font-mono';
export const BOLD = 'font-semibold';
export const MUTED = 'fill-on-canvas-muted';
export const STRIKE = 'line-through fill-on-canvas-muted';
/**
 * A label that sits on a line it must stay readable over.
 *
 * The glyphs are stroked in the ground colour and painted stroke-first, so the
 * outline knocks the line out behind the text rather than over it. This is why
 * the scroll box below is `bg-canvas` and not `bg-surface`: the halo is a colour,
 * and it has to be the colour actually behind it.
 */
export const HALO = '[paint-order:stroke] stroke-canvas [stroke-width:3] [stroke-linejoin:round]';

/*
 * And the drawing surface itself.
 *
 * `fill-on-canvas` is inherited by every `text` in the drawing, which is what
 * keeps a label from falling back to the browser's black on a dark page. The
 * baseline rule is a descendant selector because `dominant-baseline` is one of
 * the few SVG properties that does not inherit, and the drawings are laid out
 * centred: a legend's text shares the y of the circle beside it.
 */
export const DRAWING = 'fill-on-canvas [&_text]:[dominant-baseline:central]';

/**
 * A diagram is wider than the column, so it scrolls inside its own box.
 *
 * The focus stop is deliberate and is the exception `.oxlintrc.json` carries for
 * `apps/workbench/src/diagrams/*.tsx`, which is where the `tabIndex={0}` beside this
 * class actually sits, one per figure. Nothing here needs the exception; this file
 * is the class it is spelled with. Chrome and Firefox focus a scroll container on
 * their own, Safari does not, and a diagram nobody can scroll is worse than a lint
 * exception with a reason attached.
 */
export const SCROLL_BOX = cn(
  'overflow-x-auto rounded-md border border-stroke bg-canvas p-xs',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

/**
 * Identifiers in the prose around the drawings.
 *
 * `app.css` styles `code` only inside `.prose`, which is the rendered-Markdown
 * wrapper, and none of this page is that. Naming the element from its container
 * keeps the rule in one place rather than on each of the forty `code` elements
 * below.
 */
/*
 * The same inline code the documents get, since this page names the same paths.
 *
 * `overflow-wrap: anywhere` for the same reason `app.css` gives it to `.prose`:
 * a path has no break opportunity in it, and one `apps/mobile/src/lib/platform/
 * expo.ts` took the whole page sideways in a 375px window.
 */
export const PROSE_CODE =
  '[&_code]:rounded-s [&_code]:border [&_code]:border-stroke [&_code]:bg-canvas [&_code]:px-3xs [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:[overflow-wrap:anywhere]';

/*
 * The page around the drawings.
 *
 * The measure is the theme's, and only the scroll boxes are allowed past it: a
 * caption and a list are prose and want a line length, a diagram is a picture and
 * wants the width of the column.
 */
export const SECTION = 'mt-2xl first:mt-0 scroll-mt-m';
export const HEADING = 'max-w-content text-headline-xl font-semibold tracking-tight text-on-canvas';
export const LEDE = 'mt-xs max-w-content text-l leading-normal text-on-canvas-muted';
export const FIGURE = 'mt-m';
export const CAPTION = cn(
  'mt-s max-w-content text-m leading-normal text-on-canvas-muted [&_strong]:text-on-canvas',
  PROSE_CODE,
);
/** The list under each figure, which is the page for anyone who cannot see it. */
export const ALT = cn(
  'mt-m max-w-content rounded-md border border-stroke bg-surface p-sm text-m leading-normal',
  '[&_h3]:mb-xs [&_h3]:text-headline-xs [&_h3]:font-semibold [&_h3]:text-on-canvas',
  '[&_dt]:mt-s [&_dt]:font-semibold [&_dt]:text-on-canvas [&_dt:first-of-type]:mt-0',
  '[&_dd]:ml-0 [&_dd]:mt-3xs [&_dd]:text-on-canvas-muted',
  '[&_ul]:mt-3xs [&_ul]:list-disc [&_ul]:space-y-3xs [&_ul]:pl-sm',
  '[&_ol]:mt-3xs [&_ol]:list-decimal [&_ol]:space-y-3xs [&_ol]:pl-sm',
  '[&_p]:mt-xs [&_p]:text-on-canvas-muted',
  '[&_strong]:font-semibold [&_strong]:text-on-canvas',
  '[&_s]:text-on-canvas-muted',
  PROSE_CODE,
);
