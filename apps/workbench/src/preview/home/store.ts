import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';

import { publish, restore } from './write';

/**
 * The edited document, held outside the component that renders it.
 *
 * `preview/store.ts` is the same arrangement one rung up, for a version of the same
 * reason: every write goes into `localStorage` as it happens (`setLayout` calls
 * `publish` before it tells React anything changed), so the framed app is never showing
 * a document this one has moved on from. The browser's own `storage` event cannot serve
 * as the subscription here: it is fired in every same-origin document EXCEPT the one
 * that wrote, which is exactly this one — `useSyncExternalStore` is what lets the panel
 * read a value that changes outside its own render.
 */
type Listener = () => void;

let layout: HomeLayout | null = null;
const listeners = new Set<Listener>();

/**
 * Lazy, and not module scope. `restore()` reads `localStorage`, and a module evaluated
 * while the bundle loads is one more thing that has to work before the site can draw.
 */
export function getLayout(): HomeLayout {
  layout ??= restore();
  return layout;
}

export function subscribeLayout(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLayout(next: HomeLayout): void {
  layout = next;
  publish(next);
  for (const listener of listeners) listener();
}
