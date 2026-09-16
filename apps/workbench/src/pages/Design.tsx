import { Download, ExternalLink, Maximize2, RotateCw } from 'lucide-react';
import { useState } from 'react';

import docsModule from 'virtual:docs';
import { cn } from '../lib/cn';
import { href } from '../router';
import { Slot } from '../shell/slots';
import type { ShellProps } from '../shell/address';
import { Button } from '../ui/kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/kit/tooltip';

/** The file this project is designed in. One place, so nothing here is a copy. */
const FIGMA_FILE = 'https://www.figma.com/design/9n7x4eWzdZXVlRej7jWJHx/CORRECTIV-App--Aufbau';

/**
 * Figma's own embed host. It renders the file for a viewer who may open it, and
 * an access screen for one who may not, which is the honest outcome either way.
 */
const FIGMA_EMBED = `https://embed.figma.com/design/9n7x4eWzdZXVlRej7jWJHx/CORRECTIV-App--Aufbau?embed-host=correctiv-workbench`;

/** What the reader is told will be fetched, in the address bar's own words. */
const FIGMA_EMBED_SHORT = 'embed.figma.com/design/9n7x…/CORRECTIV-App--Aufbau';

const LINK =
  'font-medium text-on-canvas underline decoration-accent underline-offset-2 hover:text-on-canvas-accent';

/** The panel's card, which is the preview's readout card: `canvas` on `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas p-xs';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';

/**
 * The desktop client, per platform.
 *
 * Figma ships one for macOS and one for Windows and none for Linux, which is why
 * the third is somebody else's build. All four addresses were checked on
 * 2026-09-05 and answered.
 */
const CLIENTS: { label: string; note: string; href: string }[] = [
  {
    label: 'macOS, Apple silicon',
    note: 'Official',
    href: 'https://desktop.figma.com/mac-arm/Figma.zip',
  },
  { label: 'macOS, Intel', note: 'Official', href: 'https://desktop.figma.com/mac/Figma.zip' },
  { label: 'Windows', note: 'Official', href: 'https://desktop.figma.com/win/FigmaSetup.exe' },
  {
    label: 'Linux',
    note: 'figma-linux-next, a fork',
    href: 'https://github.com/arximus88/figma-linux-next/releases/latest',
  },
];

/**
 * The design file, framed full-bleed, and the pointers beside it.
 *
 * Framed rather than only linked, because the question this view answers is "what
 * is the screen supposed to look like", and an answer behind a click in another
 * tab is one nobody checks against the running app. The app itself is one view
 * away, at the same size, which is the comparison worth making.
 *
 * **The frame is loaded on a button press, and the surface it will fill carries
 * the explanation until then.** Not a placeholder and nothing dashed: a reader
 * who never presses the button has read what the button does, why a Figma
 * sign-in screen may follow, and where the rest of this page is. The press is
 * what makes the one request to figma.com, so no reader of a documentation site
 * fetches a third-party design file they did not ask for, and there is nothing
 * to ask consent for.
 */
export function Design({ onAddress, wide, full }: ShellProps) {
  /*
   * Page state and deliberately not in the address. `full=1` is shareable
   * because chrome is a preference; "the Figma file is loaded" must not be,
   * because a link that fetched a third-party frame on arrival is exactly what
   * the button exists to prevent.
   */
  const [framed, setFramed] = useState(false);
  const [reloads, setReloads] = useState(0);

  /** Narrow and not full: the sections are the page, so the frame gets a door. */
  const asPage = !wide && !full;

  return (
    <>
      <div
        className={cn(
          'stage-grid flex flex-col bg-surface',
          full ? 'h-dvh' : asPage ? 'min-h-[60dvh]' : 'h-full',
        )}
      >
        {framed ? (
          /*
            `allow-same-origin` beside `allow-scripts`, which oxlint warns about
            and which is right here. Its rule is about a SAME-origin frame, where
            the pair lets the document reach out and remove its own sandbox, so
            the attribute only looks like a precaution. This frame is figma.com:
            `allow-same-origin` grants it its own origin, not ours, and Figma
            needs it to reach its own storage. What the sandbox still withholds is
            what it is for here, top-level navigation above all: a third-party
            frame cannot move the page out from under the reader.
          */
          <iframe
            key={reloads}
            title="CORRECTIV App, Aufbau, in Figma"
            src={FIGMA_EMBED}
            allowFullScreen
            /*
              `allow-storage-access-by-user-activation` is the one that makes the
              difference for a reader who IS signed in. `allow-same-origin` gives
              the frame its own origin, but a browser that partitions third-party
              state gives it a partitioned jar anyway, so Figma's session cookie is
              not in it and the frame draws the sign-in screen to somebody who is
              signed in one tab over. Figma's answer is the Storage Access API, and
              without this token the browser refuses the call before Figma can even
              ask: "document.requestStorageAccess() may not be called in a sandboxed
              iframe without allow-storage-access-by-user-activation". Reported from
              a reader's console on 2026-09-11, under Firefox with dynamic state
              partitioning on.

              It grants nothing by itself. It lets the frame ASK, and the reader
              answers. A reader with no Figma access still sees the sign-in screen,
              which is a permission and not a fault.
            */
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-storage-access-by-user-activation"
            /* `bg-surface` while it loads, which is a role and so is the right
               colour in both schemes. A white flash under a dark page is the
               half second this covers. */
            className="block h-full min-h-0 w-full flex-1 border-0 bg-surface"
          />
        ) : (
          /*
            `flex` with a child that is `w-full max-w-content`, not
            `grid place-content-center`. `place-content-center` sizes the item to
            its content and centres that, so at 390px a column whose cap is wider
            than the screen overflowed on BOTH sides: the h1 read "esign" and every
            line ran off the right. Measured on 2026-09-11.
          */
          <div className="flex min-h-full flex-1 items-center justify-center px-m py-xl">
            <div className="w-full max-w-content">
              <h1 className="text-headline-xl font-bold leading-tight tracking-tight">Design</h1>
              <p className="mt-xs text-m leading-relaxed text-on-canvas">
                The app is designed in one Figma file,{' '}
                <b className="font-semibold">CORRECTIV App, Aufbau</b>. It is the source for the
                screens, and this workbench is the source for everything written down about them.
              </p>

              <dl className="mt-m rounded-md border border-stroke bg-canvas p-sm text-s">
                <dt className="font-semibold text-on-canvas">What loads</dt>
                <dd className="mt-4xs break-words font-mono text-on-canvas-muted">
                  {FIGMA_EMBED_SHORT}
                </dd>
                <dd className="mt-3xs leading-relaxed text-on-canvas-muted">
                  One request to figma.com, and none before the button is pressed.
                </dd>

                <dt className="mt-s font-semibold text-on-canvas">What you will see</dt>
                <dd className="mt-4xs leading-relaxed text-on-canvas-muted">
                  The file, if you are signed in to Figma with access to it. Figma&apos;s own
                  sign-in screen if not. That screen is a permission and not a fault: this file is
                  not shared publicly.
                </dd>
              </dl>

              <div className="mt-m">
                {asPage ? (
                  <Button size="lg" onClick={() => onAddress({ full: true })}>
                    <Maximize2 aria-hidden="true" />
                    Open full screen
                  </Button>
                ) : (
                  <Button size="lg" onClick={() => setFramed(true)}>
                    <ExternalLink aria-hidden="true" />
                    Load the Figma file
                  </Button>
                )}
                <p className={cn(NOTE, 'mt-2xs')}>
                  {asPage
                    ? 'The frame needs the width of the screen, so it opens on its own. The file itself still loads on a press.'
                    : 'from figma.com'}
                </p>
              </div>

              <p className={cn(NOTE, 'mt-m')}>
                {wide
                  ? 'Everything else about the design, the clients, the plugin and where the colours reach the code, is on the right.'
                  : 'Everything else about the design, the clients, the plugin and where the colours reach the code, is below.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2xs">
          <Button variant="outline" size="sm" asChild>
            <a href={FIGMA_FILE} target="_blank" rel="noreferrer noopener">
              <ExternalLink aria-hidden="true" />
              Open in Figma
            </a>
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reload the frame"
                disabled={!framed}
                onClick={() => setReloads((n) => n + 1)}
              >
                <RotateCw aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Reload the frame</TooltipContent>
          </Tooltip>
        </div>
      </Slot>

      <Slot id="design-links">
        <a
          className={cn(
            CARD,
            'block transition-colors hover:border-stroke-strong hover:bg-surface',
          )}
          href={FIGMA_FILE}
          target="_blank"
          rel="noreferrer noopener"
        >
          <span className="flex items-center gap-2xs text-m font-medium text-on-canvas">
            <ExternalLink aria-hidden="true" className="size-[0.875rem] shrink-0" />
            The file in Figma
          </span>
        </a>
        <a
          className={cn(
            CARD,
            'block transition-colors hover:border-stroke-strong hover:bg-surface',
          )}
          href={href('/preview')}
        >
          <span className="text-m font-medium text-on-canvas">The app, at device size</span>
        </a>
        <p className={NOTE}>
          The preview frames the running app at the size the file draws it, which is the comparison
          the file is for.
        </p>
      </Slot>

      <Slot id="design-clients">
        <p className={NOTE}>
          The plugin is loaded through Plugins, Development, Import plugin from manifest, and that
          menu exists only in the desktop app. Figma builds one for macOS and Windows; on Linux this
          project uses a fork.
        </p>
        <ul className="flex flex-col gap-3xs">
          {CLIENTS.map((client) => (
            <li key={client.href}>
              <a
                href={client.href}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  CARD,
                  'flex flex-col transition-colors hover:border-stroke-strong hover:bg-surface',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
              >
                <span className="flex items-center gap-2xs text-m font-medium text-on-canvas">
                  <Download aria-hidden="true" className="size-[0.875rem] shrink-0" />
                  {client.label}
                </span>
                <span className={cn(NOTE, 'mt-4xs')}>{client.note}</span>
              </a>
            </li>
          ))}
        </ul>
      </Slot>

      <Slot id="design-code">
        <div className={CARD}>
          <h4 className="text-m font-semibold text-on-canvas">The colours</h4>
          <p className={cn(NOTE, 'mt-3xs')}>
            Not redrawn from the file. <code className="font-mono">@correctiv/design-tokens</code>{' '}
            is generated and both the app and this site import the same stylesheet, so{' '}
            <code className="font-mono">bg-canvas</code> means one thing in three places.
          </p>
          <p className="mt-2xs text-s">
            <a className={LINK} href={href('/decisions/0010')}>
              ADR 0010
            </a>
            {' · '}
            <a className={LINK} href={href('/decisions/0022')}>
              ADR 0022
            </a>
          </p>
        </div>

        <div className={CARD}>
          <h4 className="text-m font-semibold text-on-canvas">The board</h4>
          <p className={cn(NOTE, 'mt-3xs')}>
            <code className="font-mono">tools/figma-plugin</code> draws the screen inventory into
            the file from data in this repository, rather than anybody keeping a board in step by
            hand.
          </p>
          <p className="mt-2xs text-s">
            <a className={LINK} href={href('/decisions/0021')}>
              ADR 0021
            </a>
          </p>
        </div>

        <div className={CARD}>
          <h4 className="text-m font-semibold text-on-canvas">The plugin</h4>
          <p className={cn(NOTE, 'mt-3xs')}>
            An interpreter rather than a builder: <code className="font-mono">code.js</code> knows
            nothing about the app and draws whatever <code className="font-mono">spec.json</code>{' '}
            describes. Its own documentation is a page of this site, with the three traps of the
            Linux client in it.
          </p>
          <p className="mt-2xs text-s">
            <a className={LINK} href={href('/design/plugin')}>
              The Figma plugin
            </a>
            {' · '}
            <a
              className={LINK}
              href={`${docsModule.repo}/tree/${docsModule.commit}/tools/figma-plugin`}
              target="_blank"
              rel="noreferrer noopener"
            >
              In the repository
            </a>
          </p>
        </div>
      </Slot>
    </>
  );
}
