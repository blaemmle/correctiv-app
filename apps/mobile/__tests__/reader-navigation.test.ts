import { classifyReaderLink } from '@/lib/articles/readerNavigation';

/**
 * The reader's link routing, which used to be eleven inline lines in `artikel.tsx`
 * with no test at all — the only pure rule in that screen, and the one that decides
 * whether tapping a citation keeps you in the app or throws you out of it.
 *
 * `isInternalArticleUrl` has its own suite in the core, where the rule itself now
 * lives (`packages/app-core/test/article-url.test.ts`); what is pinned here is the
 * dispatch around it, and especially the two branches that are not about articles:
 * the document's own machinery must never be intercepted, and an unrecognised
 * scheme must never be forced through the system browser.
 */
describe('classifyReaderLink', () => {
  it.each(['about:blank', 'data:image/png;base64,iVBORw0KGgo=', 'file:///android_asset/x.html'])(
    'lets the document load %s itself',
    (target) => {
      expect(classifyReaderLink(target)).toBe('allow');
    },
  );

  it.each([
    'https://correctiv.org/faktencheck/2026/08/04/video-zeigt-feiernde-fussballfans/',
    'https://correctiv.org/spotlight-newsletter/helfen-sanktionen/',
  ])('opens %s in another reader', (target) => {
    expect(classifyReaderLink(target)).toBe('internal');
  });

  it.each([
    'https://example.org/eine-quelle/',
    'https://correctiv.org/thema/aktuelles/', // internal host, but a listing page
    'http://correctiv.org/faktencheck/2026/08/04/etwas/', // no TLS
    'https://salon5.correctiv.net/podcast/pausenbrot/',
  ])('sends %s out of the app', (target) => {
    expect(classifyReaderLink(target)).toBe('external');
  });

  it.each(['mailto:redaktion@correctiv.org', 'tel:+493040549680', 'correctiv://join'])(
    'leaves %s to the webview rather than guessing',
    (target) => {
      expect(classifyReaderLink(target)).toBe('allow');
    },
  );
});
