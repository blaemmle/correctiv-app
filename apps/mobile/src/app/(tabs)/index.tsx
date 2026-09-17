import { sectionsAt } from '@correctiv/app-core/lib/home-layout';

import { Screen } from '@/components/ui';
import { useHomeLayout } from '@/lib/home/layout';
import { HOME_MODULES } from '@/lib/home/modules';
import { useDaypart } from '@/lib/useDaypart';

/**
 * Home — a curated cross-section of the ecosystem, in the draft's order: lead research,
 * today's briefing, the club's early access, the latest research, fact checks, one open
 * callout, the media row, backstage, and a quiet thank-you.
 *
 * **That order is no longer written here.** It is
 * `@correctiv/app-core/src/data/home.layout.json`, an ordered list of sections each
 * naming a module, and this screen is the loop that draws them
 * ([ADR 0036](../../../../../adr/0036-the-home-screen-becomes-data.md)). What each module
 * renders is `lib/home/modules.tsx`; which of them appear right now is `sectionsAt`,
 * which drops a hidden section and one that does not belong to this part of the day.
 *
 * `useHomeLayout` rather than a read, because the document may be replaced while this
 * screen is on it: §4's stored copy is a key in the app's own storage, and the
 * workbench's editor writes it. `lib/home/layout.ts` is where that seam is argued.
 *
 * The block that moves with the clock is that last rule and nothing more: the callout
 * has two sections in the document, one restricted to the lunchtime daypart and one to
 * the rest, so it is still rendered exactly once and still in one of two places. A
 * module the document names and this host cannot draw was dropped when the document was
 * read, with a report; the `?? null` below is the second net and not the mechanism.
 *
 * LIVE from the feeds: hero, "Neueste Recherchen", the fact-check rail and the FunFacts
 * tile. Sample data: briefing, early access, callout, backstage — each one exists to
 * show a flow the feeds cannot supply.
 */
export default function HomeScreen() {
  const daypart = useDaypart();
  const sections = sectionsAt(useHomeLayout(), daypart);

  return (
    <Screen>
      {sections.map((section) => {
        const Module = HOME_MODULES[section.module];
        return Module ? <Module key={section.id} section={section} /> : null;
      })}
    </Screen>
  );
}
