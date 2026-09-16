import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The one shape every view has: a padded column, filled, left to right.
 *
 * Left-aligned and full width rather than centred behind a maximum, because the
 * column is already as wide as the reader made it. Two sidebars decide that, and
 * a second cap inside them left 362 pixels of empty page on each side of a
 * drawing that was scrolling for want of room.
 *
 * What is bounded is the reading measure, and that is bounded where it belongs,
 * on the prose. A paragraph gets `max-w-content`; a diagram, a table and a board
 * get the column.
 */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-m py-ml lg:px-ml', className)}>{children}</div>;
}
