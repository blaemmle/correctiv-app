import { DIAGRAMS } from './diagrams';

/**
 * What each self-answered route is called, for the browser tab and the palette.
 *
 * The document routes take their title from the document's own h1. These have no
 * document, and deriving a title from the path gave "workbench — Handbook" in
 * lower case, which is what a route is named and not what a page is called.
 */
export const PAGE_TITLES: Record<string, string> = {
  '/': 'CORRECTIV app handbook',
  '/handbook': 'Handbook',
  ...Object.fromEntries(DIAGRAMS.map((d) => [`/diagrams/${d.id}`, d.title])),
  '/components': 'Components, the app’s own',
  '/decisions': 'Decision records',
  '/design': 'Design, the Figma file',
  '/diagrams': 'Architecture diagrams',
  '/reference': 'Reference, the core',
  '/sources': 'Sources status board',
  '/workbench': 'Workbench',
};

/**
 * The anchor the reference gives each symbol, and the palette jumps to.
 *
 * Here rather than in either of them: two places deriving the same id is how a
 * search result quietly stops landing anywhere.
 */
export function symbolId(subpath: string, name: string): string {
  return `s-${subpath.replace(/\//g, '-')}-${name}`;
}

/**
 * The same, for a component, and the platform is part of it.
 *
 * `media/VideoFrame` is two components with one name, one for the device and one
 * for the web, and an anchor that ignored the difference would send both halves
 * of the palette to whichever row rendered first.
 */
export function componentId(group: string, name: string, platform: string | null): string {
  return `c-${group}-${name}${platform ? `-${platform}` : ''}`;
}
