import { describe, expect, it } from 'vitest';

import { parseAddress, writeAddress, toggled, type ShellAddress } from '../../src/shell/address.ts';
import { VIEWS, type SectionId, type ViewDeclaration } from '../../src/shell/views.ts';

const DOCUMENT = VIEWS.document;
const PREVIEW = VIEWS.preview;
const COMPONENT = VIEWS.component;

/** A view's own defaults, which is what an empty hash means on it. */
function defaults(view: ViewDeclaration, head = ''): ShellAddress {
  return {
    head,
    tools: view.sections.length > 0 && view.panelOpenByDefault,
    open: new Set(view.openByDefault),
    full: false,
    rest: new URLSearchParams(),
  };
}

describe('the hash contract, on every route', () => {
  it('round-trips every view with every parameter at its non-default', () => {
    for (const view of Object.values(VIEWS)) {
      const flipped: ShellAddress = {
        head: view.kind === 'preview' ? '/artikel' : 'the-four-ports',
        tools: view.sections.length > 0 && !view.panelOpenByDefault,
        // Everything declared, minus whatever opens by default, so the set
        // differs from the default on every view that has one.
        open: new Set(view.sections.filter((id) => !view.openByDefault.includes(id))),
        full: view.canGoFull,
        rest: new URLSearchParams({ d: 'ipad-mini' }),
      };

      const back = parseAddress(writeAddress(flipped, view), view);

      // One object per view, so a failure names the view rather than a boolean.
      expect({
        kind: view.kind,
        head: back.head,
        tools: back.tools,
        open: [...back.open],
        full: back.full,
        device: back.rest.get('d'),
      }).toEqual({
        kind: view.kind,
        head: flipped.head,
        tools: flipped.tools,
        open: [...flipped.open],
        full: flipped.full,
        device: 'ipad-mini',
      });
    }
  });

  /**
   * The one thing that makes the grammar safe: an app route starts with `/` and a
   * heading id never does, because `src/lib/slug.ts` strips everything but
   * letters, digits, spaces and hyphens — for every id this site mints, since
   * the board stopped carrying a second copy of that function.
   */
  it('keeps a document anchor an anchor when nothing else is said', () => {
    expect(parseAddress('#the-four-ports', DOCUMENT).head).toBe('the-four-ports');
    expect(writeAddress(defaults(DOCUMENT, 'the-four-ports'), DOCUMENT)).toBe('#the-four-ports');
  });

  it('writes nothing at all when nothing differs and there is no head', () => {
    expect(writeAddress(defaults(DOCUMENT), DOCUMENT)).toBe('');
  });

  it('appends the panel to an anchor only when the panel is not the default', () => {
    const open: ShellAddress = { ...defaults(DOCUMENT, 'the-four-ports'), tools: true };
    expect(writeAddress(open, DOCUMENT)).toBe('#the-four-ports?tools=1');
    expect(parseAddress('#the-four-ports?tools=1', DOCUMENT).tools).toBe(true);
  });

  it('says shut as loudly as it says open, where the default is open', () => {
    // `/design` opens its panel by default, so a reader who shut it has said
    // something and the link has to carry it.
    const shut: ShellAddress = { ...defaults(VIEWS.design), tools: false };
    expect(writeAddress(shut, VIEWS.design)).toBe('#?tools=0');
    expect(parseAddress('#?tools=0', VIEWS.design).tools).toBe(false);
  });

  it('still reads a preview link written before the shell owned the hash', () => {
    const address = parseAddress('#/artikel?d=ipad-mini&o=l&tools=1', PREVIEW);

    expect(address.head).toBe('/artikel');
    expect(address.tools).toBe(true);
    expect(address.rest.get('d')).toBe('ipad-mini');
    expect(address.rest.get('o')).toBe('l');
    // The three names the shell owns never reach the view.
    expect(address.rest.has('tools')).toBe(false);
  });

  it('drops a section the open view does not declare rather than refusing the link', () => {
    const address = parseAddress('#?open=console,design-links,measure', PREVIEW);
    expect([...address.open]).toEqual(['console', 'measure']);
  });

  it('ignores `full` on a view that cannot go full', () => {
    expect(parseAddress('#?full=1', DOCUMENT).full).toBe(false);
    expect(writeAddress({ ...defaults(DOCUMENT), full: true }, DOCUMENT)).toBe('');
  });

  it('writes the open set in the view’s own order, so a link does not churn', () => {
    const open = new Set<SectionId>(['props', 'rendering']);
    const forwards = writeAddress({ ...defaults(COMPONENT), open }, COMPONENT);
    const backwards = writeAddress(
      { ...defaults(COMPONENT), open: new Set<SectionId>(['rendering', 'props']) },
      COMPONENT,
    );
    expect(forwards).toBe(backwards);
    expect(forwards).toContain('rendering%2Cprops');
  });

  it('carries a view’s own parameters through untouched', () => {
    const address = parseAddress('#?r=bundle&d=pixel-8', COMPONENT);
    expect(address.rest.get('r')).toBe('bundle');
    expect(writeAddress(address, COMPONENT)).toBe('#?r=bundle&d=pixel-8');
  });

  it('toggles one section without touching the rest', () => {
    const open = new Set<SectionId>(['rendering', 'device']);
    expect([...toggled(open, 'props')]).toEqual(['rendering', 'device', 'props']);
    expect([...toggled(open, 'device')]).toEqual(['rendering']);
  });
});
