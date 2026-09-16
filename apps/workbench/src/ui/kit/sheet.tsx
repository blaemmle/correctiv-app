import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';

import { DialogOverlay } from './dialog';
import { cn } from '../../lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

/**
 * A panel docked to an edge, which slides in from the edge it is docked to.
 *
 * This is what the sidebars become when there is no width to divide. A dialog
 * rather than a positioned div, so it does what a drawer over a page has to do
 * and what a div does not: trap focus, close on Escape, close on a tap outside,
 * and hide the page behind it from a screen reader.
 *
 * The motion is not decoration. Two panels open on the same edge from opposite
 * sides of the screen, and where a panel came from is the only thing that says
 * which one it is before you have read it.
 */
export function SheetContent({
  side,
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { side: 'left' | 'right' }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex flex-col bg-canvas shadow-2xl',
          'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
          side === 'left'
            ? 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
            : 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          className,
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}
