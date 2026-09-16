import { PanelLeftClose, PanelRightClose } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';

import { Button } from './kit/button';
import { cn } from '../lib/cn';

interface Props {
  title: string;
  side: 'left' | 'right';
  onClose: () => void;
  children: ReactNode;
  /**
   * Off where the child keeps a head of its own that has to stay put while the
   * rest scrolls. Two scrollers in one column is the bug this prevents.
   */
  scroll?: boolean;
  /**
   * The element the title is, which is `h2` docked and `Dialog.Title` in a
   * drawer. Radix names the drawer by its title, so passing it here keeps one
   * visible heading instead of a visible one and a screen-reader-only twin.
   */
  titleAs?: ElementType;
}

/**
 * A docked sidebar: a title, a way to shut it, and a body that scrolls.
 *
 * Both sides use it, which is the point. The tools were a switch in a toolbar
 * before, and a switch says "on or off" where a sidebar says "here is a surface,
 * it belongs to the page, and you can put it away". The difference matters
 * because the tools are not a mode: the app is still there with them open.
 */
export function SidePanel({
  title,
  side,
  onClose,
  children,
  scroll = true,
  titleAs: Title = 'h2',
}: Props) {
  const Icon = side === 'left' ? PanelLeftClose : PanelRightClose;
  return (
    <aside
      aria-label={title}
      className={cn(
        'flex h-full min-h-0 flex-col bg-canvas',
        side === 'left' ? 'border-r border-stroke' : 'border-l border-stroke',
      )}
    >
      <div className="flex h-[2.25rem] shrink-0 items-center gap-xs border-b border-stroke pl-s pr-3xs">
        <Title className="flex-1 truncate text-s font-semibold uppercase tracking-wider text-on-canvas-muted">
          {title}
        </Title>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
          className="size-[1.75rem]"
        >
          <Icon aria-hidden="true" />
        </Button>
      </div>
      <div className={cn('min-h-0 flex-1', scroll ? 'overflow-y-auto' : 'overflow-hidden')}>
        {children}
      </div>
    </aside>
  );
}
