/**
 * Which of the app's components this site cannot draw in its own React tree.
 *
 * A list of exceptions, not of members. `direct.tsx` takes its roster from the
 * app's own `gallery/catalogue.tsx`, so the question this file answers is the
 * only one the app cannot answer for itself: which entries fail once they are
 * mounted by React DOM instead of by React Native.
 *
 * Plain data and no React, so `test/direct.test.ts` can hold these ids against
 * `content/api.generated.json` without React Native or a Vite build in the way.
 *
 * **Measured, not guessed** (decision 18 of the redesign). Every entry carries
 * the reason in the words the card prints, because a reader looking at a card
 * that says "drawn in the app's bundle" is owed the reason on the page rather
 * than in a commit message.
 *
 * `group/name` is the app's own address for a component — `gallery/catalogue.tsx`'s
 * `componentId`, and the string `?c=` carries in both directions.
 */
export const NOT_DRAWN: Record<string, string> = {};

/** Whether `group/name` is one this site draws itself. */
export function isDrawnHere(id: string): boolean {
  return !(id in NOT_DRAWN);
}
