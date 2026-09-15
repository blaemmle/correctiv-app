import { isInternalArticleUrl } from '@correctiv/app-core/articles/url';

/**
 * What the reader should do with a target the document tried to open.
 *
 * `allow` lets the webview navigate itself, `internal` pushes another reader,
 * `external` leaves the app.
 */
export type ReaderLinkAction = 'allow' | 'internal' | 'external';

/**
 * The reader intercepts every navigation the document starts, which is not the
 * same set as "links the reader tapped".
 *
 * `about:blank` is the document loading itself, and `data:` and `file:` are the
 * inlined images and the embedded fonts. Blocking those blocks the article, so
 * they are checked first and by scheme rather than by URL shape.
 *
 * What is left splits on `isInternalArticleUrl`, whose own rules and their history
 * are worth reading before changing anything here. That rule is the core's, because
 * it is a fact about correctiv.org; this dispatch is the host's, because the set of
 * navigations it sorts is a WebView's and an iframe's rather than the domain's.
 *
 * The final `allow` is for a scheme that is neither: `mailto:`, `tel:`, or an app
 * link. Handing those to the webview is what the reader has always done, and it is
 * the conservative branch — the app does not decide what it does not recognise.
 * There used to be a fourth case, `correctiv://join`, for a button in the reader's
 * second footer; ADR 0018 removed the footer and a test in the core now asserts
 * that scheme never reaches a document again.
 */
export function classifyReaderLink(target: string): ReaderLinkAction {
  if (target === 'about:blank' || target.startsWith('data:') || target.startsWith('file:')) {
    return 'allow';
  }
  if (isInternalArticleUrl(target)) return 'internal';
  if (/^https?:/.test(target)) return 'external';
  return 'allow';
}
