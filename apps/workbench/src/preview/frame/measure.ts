import { activeScheme } from './handle';
import { PALETTE, TOKENS, toRgb, type Scheme } from './tokens';

/**
 * The three things a person misses on the twentieth screenshot.
 *
 * This does not replace looking, and nothing here should ever be presented as if
 * it did — `AGENTS.md` is blunt that a green check is not evidence about how the
 * app looks. What it does is take the mechanical part off the person: a row that
 * overflows by four pixels, a tap target too small for a thumb, and a colour that
 * is not in the palette at all.
 *
 * The colour check has a known blind spot and states it rather than hiding it: a
 * value match cannot say which token was meant, because several tokens share a
 * value. Counted in `tokens.generated.ts`, the light palette puts 35 tokens on 12
 * distinct values and the dark one puts them on 20, so the same reading is less
 * ambiguous in dark, which is why the report says to run it there. Less, not
 * unambiguous: dark collides too.
 */
export interface Finding {
  kind: 'overflow' | 'tap-target' | 'off-palette';
  text: string;
  /** A short path, enough to find the node in DevTools. */
  where?: string;
}

const OUTLINE_ID = 'preview-outline';
const MIN_TAP = 44;
/**
 * Declared controls only. `[tabindex]` would be tempting and is wrong here:
 * react-native-web puts one on a great many plain views, so including it turns
 * the check into a list of every scroll container on the screen.
 */
const TAPPABLE = 'a[href], button, [role="button"], [role="link"], [role="tab"]';

/**
 * Expo's dev-server error toast, which is in the frame's DOM but is not the app.
 * Left in, it supplies most of the findings on any page where a feed failed —
 * and on web every feed fails, so that would be every page. A checker whose
 * output is mostly noise gets ignored, which is worse than not having one.
 */
const NOT_THE_APP = '#error-toast';

/** A node with text of its own, as opposed to one that merely inherits a colour. */
function hasOwnText(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (node) => node.nodeType === 3 && (node.textContent ?? '').trim() !== '',
  );
}

export function setOutline(win: Window | null, on: boolean): void {
  const doc = win?.document;
  if (!doc) return;
  const existing = doc.getElementById(OUTLINE_ID);
  if (!on) return existing?.remove();
  const style = existing ?? doc.createElement('style');
  style.id = OUTLINE_ID;
  style.textContent = '*{outline:1px solid rgb(255 80 100 / 30%) !important}';
  doc.head.append(style);
}

/**
 * Something a person can find the node by. React Native Web's class names are
 * generated (`css-view-g5y9jx`), so a CSS path says nothing; the accessibility
 * label is both readable and the handle the Android tour already taps by.
 */
function path(el: Element): string {
  const label = el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();
  const role = el.getAttribute('role') ?? el.tagName.toLowerCase();
  return label ? `${role} "${label.slice(0, 40)}"` : role;
}

export function audit(win: Window | null): {
  findings: Finding[];
  scheme: Scheme;
  scanned: number;
} {
  const doc = win?.document;
  const scheme = activeScheme(win);
  if (!doc || !win) return { findings: [], scheme, scanned: 0 };

  const findings: Finding[] = [];
  const palette = new Set(
    TOKENS.map((token) => toRgb(PALETTE[scheme][token])).filter((v): v is string => v !== null),
  );

  const viewport = doc.documentElement.clientWidth;
  const scroller = doc.scrollingElement ?? doc.documentElement;
  if (scroller.scrollWidth > viewport + 1) {
    findings.push({
      kind: 'overflow',
      text: `The page scrolls sideways: ${scroller.scrollWidth}px of content in ${viewport}px.`,
    });
  }

  const elements = Array.from(doc.body.querySelectorAll('*'));
  for (const el of elements) {
    if (el.closest(NOT_THE_APP)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    if (rect.right > viewport + 1 && el.children.length === 0) {
      findings.push({
        kind: 'overflow',
        text: `Reaches ${Math.round(rect.right)}px, past the ${viewport}px edge.`,
        where: path(el),
      });
    }

    if (el.matches(TAPPABLE) && (rect.width < MIN_TAP || rect.height < MIN_TAP)) {
      findings.push({
        kind: 'tap-target',
        text: `${Math.round(rect.width)}×${Math.round(rect.height)}px, under the ${MIN_TAP}px a thumb needs.`,
        where: path(el),
      });
    }

    const style = win.getComputedStyle(el);
    for (const property of ['color', 'backgroundColor'] as const) {
      const value = style[property];
      if (!value.startsWith('rgb(') || palette.has(value)) continue;
      // A colour is only a finding where it is visible: on a node that draws its
      // own text, or on a painted surface. Everywhere else it is inherited and
      // will be reported once, at the node that shows it.
      if (property === 'color' && !hasOwnText(el)) continue;
      findings.push({
        kind: 'off-palette',
        text: `${property}: ${value} is not a ${scheme} token.`,
        where: path(el),
      });
    }
  }

  // One line per distinct complaint; twenty rows with the same colour are one finding.
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.kind}|${f.text}`;
    return seen.has(key) ? false : (seen.add(key), true);
  });

  return { findings: unique.slice(0, 40), scheme, scanned: elements.length };
}
