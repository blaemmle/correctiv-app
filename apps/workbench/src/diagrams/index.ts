import { CoreAndHost, CoreAndHostDrawing } from './CoreAndHost';
import { DecisionsChain, DecisionsChainDrawing } from './DecisionsChain';
import { InsideCore, InsideCoreDrawing } from './InsideCore';
import { Services, ServicesDrawing } from './Services';

import docs from 'virtual:docs';
import type { ReactNode } from 'react';

/** However many records `adr/` holds today. */
const RECORD_COUNT = docs.docs.filter((d) => d.route.startsWith('/decisions/')).length;

/**
 * One drawing, described well enough to place it without rendering it.
 *
 * The figure and the drawing are two exports because they answer two questions.
 * A page that has room for the whole thing takes `Figure`, which brings the
 * scroll box, the caption and the list with it. Anything that only wants the
 * picture, at a size it has to know in advance, takes `Drawing` and the two
 * numbers beside it.
 */
export interface DiagramMeta {
  /** The section id it already carries, which is also its route segment. */
  id: string;
  /** The `<h2>` text as it stands today, WITHOUT the leading number. */
  title: string;
  /** The lede paragraph's text as it stands today, as a plain string. */
  lede: string;
  /** The `<svg>`'s own width and height in its coordinate space, from its classes. */
  width: number;
  height: number;
  Figure: (props: { alt?: boolean }) => ReactNode;
  /** The picture alone, for a thumbnail. It describes itself with its `<title>`. */
  Drawing: () => ReactNode;
}

/**
 * The four drawings, in the order `/diagrams` shows them.
 *
 * They are hand-authored inline SVG rather than images because a drawing whose
 * every fill and stroke comes from a class follows the light and dark schemes on
 * its own, with no second asset to keep in step.
 */
export const DIAGRAMS: DiagramMeta[] = [
  {
    id: 'core-host',
    title: 'The core and its host',
    lede: 'All behaviour on one side, all platform on the other. The only crossing is five named ports, and the two small files that answer them are the whole cost of adding a host.',
    width: 1100,
    height: 710,
    Figure: CoreAndHost,
    Drawing: CoreAndHostDrawing,
  },
  {
    id: 'decisions',
    title: 'Which decisions still stand, and which of their claims do not',
    // The count is read, not typed. It said twenty-three while `adr/` held
    // twenty-four, which is the failure `AGENTS.md` names under "Facts that
    // expire": a figure measured once and then left to go quietly wrong.
    lede: `${RECORD_COUNT} records, never rewritten. When a later decision makes an earlier claim false, the claim is struck through where it stands and the later record names what it retired. Read a row to see whether a record still holds; follow the arcs to see who amended it.`,
    width: 1100,
    height: 985,
    Figure: DecisionsChain,
    Drawing: DecisionsChainDrawing,
  },
  {
    id: 'services',
    title: 'The app and what it talks to',
    lede: 'One of these is not like the others. beabee answers who somebody is and whether their membership includes the app; everything else answers what to show them. Most of the content is live today, and the identity half is still simulated.',
    // The one drawing sized by its viewBox rather than a height class, because it
    // is `h-auto`: 980 by 580 is what the viewBox says.
    width: 980,
    height: 580,
    Figure: Services,
    Drawing: ServicesDrawing,
  },
  {
    id: 'inside-core',
    title: 'Inside the core',
    lede: '56 TypeScript files in seven layers. Imports point down the stack, the contracts sit at the bottom, and below them is a line nothing in the package crosses.',
    width: 1040,
    height: 746,
    Figure: InsideCore,
    Drawing: InsideCoreDrawing,
  },
];
