import {
  Braces,
  ChevronRight,
  Crosshair,
  Database,
  Download,
  ExternalLink,
  FileCode,
  GitBranch,
  Layers,
  ListTree,
  Palette,
  Ruler,
  Smartphone,
  SunMoon,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '../lib/cn';
import { SECTION_TITLES, type SectionId } from '../shell/views';
import { SlotTarget } from '../shell/slots';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './kit/collapsible';

/**
 * The mark beside each section's title.
 *
 * Beside the chrome that draws it rather than in `shell/views.ts`, which is pure
 * data so a test can read the table without pulling React in. Keyed by the same
 * type as `SECTION_TITLES`, so a section with a title and no icon does not
 * compile.
 */
const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  contents: ListTree,
  appearance: SunMoon,
  state: Database,
  console: Terminal,
  tokens: Palette,
  measure: Ruler,
  inspect: Crosshair,
  'design-links': ExternalLink,
  'design-clients': Download,
  'design-code': GitBranch,
  rendering: Layers,
  device: Smartphone,
  props: Braces,
  source: FileCode,
};

/**
 * One collapsible section of the right panel, and the two slots it offers.
 *
 * This was `Panel`, private to `workbench/ui/Panels.tsx`, where a comment said
 * "which panels are open is local to this component". It is lifted here
 * unchanged in what it draws and changed in two things: whether it is open comes
 * from the address, so it is in the URL and can be handed over as a link, and
 * what is inside it comes from the open page through a portal rather than from a
 * child this file is given.
 *
 * `forceMount` on the body is load-bearing. Radix unmounts a closed panel's
 * content, which would take the slot's target with it — and with the target gone
 * the page's `Slot` renders nothing, so the console's level filter and the
 * component route's device choice would both reset every time somebody collapsed
 * the section they live in. Mounted and `hidden` keeps them, and `hidden` is
 * `display: none`, so a shut section is out of the accessibility tree either way.
 *
 * **And `hidden` has to be written here, because `forceMount` is what takes it
 * away.** Radix does not hide a closed body itself; it asks `Presence` whether
 * the body is still there and writes `hidden={!present}` from the answer.
 * `forceMount` pins that answer to "present" for ever — `isOpen = open ||
 * isPresent` inside `CollapsibleContentImpl`, and `isPresent` never goes false —
 * so the attribute this component was relying on was never written. Every
 * section of every panel opened and stayed open: the address took the toggle, the
 * trigger's `data-state` flipped, the chevron turned, and the body did not move.
 * The prop spread lands after Radix's own `hidden`, so saying it here is what
 * decides it.
 *
 * The hover is `surface` on the panel's own `canvas`, which is the inverse of
 * the dock this came from: `SidePanel` paints `canvas`, so a row that hovered to
 * `canvas` hovered to no change at all.
 */
export function Section({
  id,
  open,
  onToggle,
}: {
  id: SectionId;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = SECTION_ICONS[id];
  return (
    <Collapsible open={open} onOpenChange={onToggle} asChild>
      <section className="border-b border-stroke last:border-b-0">
        {/* The heading carries the trigger rather than sitting beside it, so the
            section appears once in the document outline and is announced once.
            Radix puts `aria-expanded` and `aria-controls` on the trigger and the
            matching id on the body, which is the pair a `<details>` cannot be
            given and this panel needs, because the head has buttons that open a
            section from the outside. */}
        <h3>
          <CollapsibleTrigger
            className={cn(
              'group flex w-full flex-wrap items-center gap-xs px-s py-xs text-left hover:bg-surface',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
            )}
          >
            <ChevronRight
              aria-hidden="true"
              className="size-[0.875rem] shrink-0 text-on-canvas-muted transition-transform group-data-[state=open]:rotate-90"
            />
            <Icon aria-hidden="true" className="size-[0.875rem] shrink-0 text-on-canvas-muted" />
            <span className="min-w-0 text-m font-semibold text-on-canvas">
              {SECTION_TITLES[id]}
            </span>
            <SlotTarget
              id={`${id}:tags`}
              as="span"
              className="ml-auto flex flex-wrap items-center justify-end gap-3xs empty:hidden"
            />
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent forceMount hidden={!open} className="overflow-hidden">
          <SlotTarget id={id} className="flex flex-col gap-s px-s pb-s" />
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
