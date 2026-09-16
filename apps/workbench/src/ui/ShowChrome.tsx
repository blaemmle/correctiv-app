import { PanelsTopLeft } from 'lucide-react';

import { Button } from './kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './kit/tooltip';

/**
 * The one thing left on screen when the chrome is out of the way.
 *
 * Floating rather than docked, because docking it would cost the row the chrome
 * just gave back. Top right, over the app, on its own ground with a border so it
 * is legible against whatever the app happens to be painting underneath: this
 * button is the only way back, and a button that disappears into a light screen
 * strands whoever pressed the one before it.
 */
export function ShowChrome({ onShow }: { onShow: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={onShow}
          aria-label="Show the toolbar and sidebars"
          className="fixed right-s top-s z-40 size-[2.25rem] rounded-full border-stroke-strong bg-canvas shadow-lg"
        >
          <PanelsTopLeft aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Show the toolbar · Esc</TooltipContent>
    </Tooltip>
  );
}
