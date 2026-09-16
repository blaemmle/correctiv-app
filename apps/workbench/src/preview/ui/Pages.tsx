import { Command } from 'cmdk';
import { List } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../ui/kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';
import { PAGES } from '../routes';

/**
 * The pages worth reaching, as a command list rather than a `select`.
 *
 * It was a `select` first, and that was the wrong element for two reasons a
 * review found by pressing keys. A `select` whose value is always the empty
 * placeholder cannot be arrowed: every Down from the closed control lands on the
 * first option and navigates there, so a keyboard reflex silently loses the route
 * you were looking at. And it takes the width of its widest option, which here is
 * a sentence, so the notes had to be capped away to keep the route field usable.
 *
 * A command list has neither problem, and the notes are the point: `/behauptung/
 * claim-001` is not an address anybody guesses, and the label alone does not say
 * that `/formular` is the participation form. It also types to filter, which the
 * `datalist` on the route field does for paths and this now does for names.
 *
 * `cmdk` rather than a menu of our own, because `ui/Search.tsx` is already built
 * on it and this is the same interaction one bar down.
 */
export function Pages({ onPick }: { onPick: (route: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go to a page"
            onClick={() => setOpen(true)}
          >
            <List aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Go to a page</TooltipContent>
      </Tooltip>

      <Command.Dialog
        loop
        open={open}
        onOpenChange={setOpen}
        label="Go to a page"
        overlayClassName="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(34rem,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-stroke bg-canvas shadow-2xl duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      >
        <Command.Input
          autoFocus
          placeholder="Go to a page"
          className="w-full border-b border-stroke bg-transparent px-sm py-s text-m text-on-canvas outline-none placeholder:text-on-canvas-muted"
        />
        <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-xs">
          <Command.Empty className="px-s py-m text-center text-m text-on-canvas-muted">
            No page of that name. The field beside this one takes any address.
          </Command.Empty>

          {PAGES.map((group) => (
            <Command.Group
              key={group.group}
              heading={group.group}
              className="[&_[cmdk-group-heading]]:px-xs [&_[cmdk-group-heading]]:py-2xs [&_[cmdk-group-heading]]:text-s [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-on-canvas-muted"
            >
              {group.pages.map((page) => (
                <Command.Item
                  // The route is in the searchable value as well as the label, so
                  // somebody who does know the address can still type it here.
                  key={page.route}
                  value={`${page.label} ${page.route} ${page.note ?? ''}`}
                  onSelect={() => {
                    onPick(page.route);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-baseline gap-xs rounded-md px-xs py-2xs text-m text-on-canvas data-[selected=true]:bg-surface"
                >
                  <span className="shrink-0 font-medium">{page.label}</span>
                  {page.note && (
                    <span className="min-w-0 flex-1 truncate text-s text-on-canvas-muted">
                      {page.note}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 pl-s font-mono text-s text-on-canvas-muted">
                    {page.route}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
