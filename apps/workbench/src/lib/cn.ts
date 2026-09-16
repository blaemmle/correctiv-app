import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names and lets a later one win over an earlier one.
 *
 * The second half is the point. Every component here takes a `className` so a
 * caller can adjust it, and without `twMerge` a caller passing `p-0` next to a
 * component's own `p-4` gets both, with the winner decided by the order Tailwind
 * happened to emit them in. This is the function shadcn's components expect to
 * find, which is why it has that name.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
