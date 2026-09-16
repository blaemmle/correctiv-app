import type { ElementType } from 'react';

import { SlotTarget } from '../shell/slots';
import type { SectionId, ViewDeclaration } from '../shell/views';
import { Section } from './Section';
import { SidePanel } from './SidePanel';

/**
 * The right sidebar, whatever the open view is.
 *
 * One component for a document's contents, the design tools, a component's props
 * and the preview's inspector, because they are the same furniture: a title, a
 * way to shut it, an optional strip that stays put, and a scrolling column of
 * collapsible sections. Which sections those are is the route's declaration; what
 * is inside them is the page's, through the slots.
 *
 * `scroll={false}` on the panel and the scroller one level down, so the head can
 * stay put while the sections move under it. Two scrollers in one column was the
 * bug that rule prevents.
 */
export function ContextPanel({
  view,
  open,
  onToggleSection,
  onClose,
  titleAs,
}: {
  view: ViewDeclaration;
  open: ReadonlySet<SectionId>;
  onToggleSection: (id: SectionId) => void;
  onClose: () => void;
  /** `Dialog.Title` in the narrow drawer, an `h2` docked. */
  titleAs?: ElementType;
}) {
  if (view.panelTitle === null) return null;

  return (
    <SidePanel
      title={view.panelTitle}
      side="right"
      scroll={false}
      titleAs={titleAs}
      onClose={onClose}
    >
      <div className="flex h-full min-h-0 flex-col">
        {view.panelHead && (
          <SlotTarget id="panel-head" className="shrink-0 border-b border-stroke empty:hidden" />
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view.sections.map((id) => (
            <Section key={id} id={id} open={open.has(id)} onToggle={() => onToggleSection(id)} />
          ))}
        </div>
      </div>
    </SidePanel>
  );
}

/**
 * The same sections, inline under the page, where there is no room for a panel.
 *
 * Below the wide breakpoint a `narrow: 'page'` view has no sidebar and no drawer:
 * the context *is* the page, after it. A fifty-five pixel panel and a phone-sized
 * drawer are both worse than the column the reader already has.
 */
export function NarrowSections({
  view,
  open,
  onToggleSection,
}: {
  view: ViewDeclaration;
  open: ReadonlySet<SectionId>;
  onToggleSection: (id: SectionId) => void;
}) {
  if (view.sections.length === 0) return null;

  return (
    <section aria-label={view.panelTitle ?? undefined} className="border-t border-stroke">
      {view.panelHead && (
        <SlotTarget id="panel-head" className="border-b border-stroke empty:hidden" />
      )}
      {view.sections.map((id) => (
        <Section key={id} id={id} open={open.has(id)} onToggle={() => onToggleSection(id)} />
      ))}
    </section>
  );
}
