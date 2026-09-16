import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SlotProvider, slotsOf } from '../../src/shell/slots.tsx';
import { Section } from '../../src/ui/Section.tsx';
import { VIEWS, type SectionId, type ViewDeclaration } from '../../src/shell/views.ts';

/**
 * What a shut section does, which is the half the address cannot see.
 *
 * `shell/address.ts` has a test of its own and it passed while every section of
 * every panel was stuck open. A reader clicking the chevron in the workbench's
 * inspector got `open=` rewritten in the URL, the trigger's `data-state` flipped,
 * the chevron turned, and the body did not move: `forceMount` pins Radix's
 * presence on, so the `hidden` the collapsible would otherwise write was never
 * written. The half that was checked was right and the half that was not went
 * nowhere, so this one is over the rendered markup rather than over the hash.
 *
 * `renderToStaticMarkup` rather than a browser, because the defect is in the
 * first render and not in an interaction — a shut section is drawn open before
 * anything has been clicked. It also costs no jsdom, and `handbook:renders` is
 * what opens a real page.
 *
 * The slot targets render empty here, since a portal has nothing to carry until a
 * page mounts one, so what is asserted is where they SIT: the tags target in the
 * trigger, which stays visible while the section is shut, and the body target
 * inside the collapsible, which stays mounted so the page's `Slot` keeps its
 * place to draw into.
 *
 * One object per assertion rather than an `expect` per section, as
 * `test/shell/address.test.ts` does it and for the same reason: a failure names
 * every section that is wrong, and this defect was wrong in all of them at once.
 */

/** Every section the site declares, each with the view that offers it. */
const SECTIONS: readonly (readonly [SectionId, ViewDeclaration])[] = Object.values(VIEWS).flatMap(
  (view) => view.sections.map((id) => [id, view] as const),
);

/**
 * React writes a boolean attribute as `hidden=""`, so this matches nothing else
 * in the markup: `aria-hidden="true"` on the two icons has a value, and the
 * Tailwind class `empty:hidden` is inside a `class` attribute.
 */
const HIDDEN = 'hidden=""';

/** The trigger's markup and the body's, split at the one button in a section. */
function halves(id: SectionId, view: ViewDeclaration, open: boolean) {
  const html = renderToStaticMarkup(
    <SlotProvider declared={slotsOf(view)}>
      <Section id={id} open={open} onToggle={() => {}} />
    </SlotProvider>,
  );
  const end = html.indexOf('</button>');
  if (end === -1)
    throw new Error(`${view.kind}/${id}: a section draws one trigger, and this has none`);
  return { trigger: html.slice(0, end), body: html.slice(end) };
}

/** The same answer for every section, which is what each of these expects. */
function each<T>(answer: (id: SectionId, view: ViewDeclaration) => T): Record<string, T> {
  return Object.fromEntries(SECTIONS.map(([id, view]) => [`${view.kind}/${id}`, answer(id, view)]));
}

describe('a section of the right panel, shut and open', () => {
  it('hides the body of a shut section and shows it again when it opens', () => {
    expect(
      each((id, view) => ({
        shut: halves(id, view, false).body.includes(HIDDEN) ? 'hidden' : 'on screen',
        open: halves(id, view, true).body.includes(HIDDEN) ? 'hidden' : 'on screen',
      })),
    ).toEqual(each(() => ({ shut: 'hidden', open: 'on screen' })));
  });

  it('keeps the badges of a shut section, which is what their own slot is for', () => {
    // ADR 0028 §1: the tags are a slot of their own because "0 warnings" is worth
    // reading without opening the console. Hiding the trigger, or moving the tags
    // into the body, would take them down with the fold.
    expect(
      each((id, view) => {
        const { trigger } = halves(id, view, false);
        return {
          tags: trigger.includes(`data-slot="${id}:tags"`) ? 'in the trigger' : 'nowhere',
          trigger: trigger.includes(HIDDEN) ? 'hidden' : 'on screen',
        };
      }),
    ).toEqual(each(() => ({ tags: 'in the trigger', trigger: 'on screen' })));
  });

  it('keeps the body slot mounted while the section is shut', () => {
    // `forceMount`, and the reason for it: unmounting the target would take the
    // console's level filter and the component route's device choice with it every
    // time somebody collapsed the section they live in.
    expect(
      each((id, view) =>
        halves(id, view, false).body.includes(`data-slot="${id}"`) ? 'mounted' : 'gone',
      ),
    ).toEqual(each(() => 'mounted'));
  });
});
