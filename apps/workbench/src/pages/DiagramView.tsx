import { ArrowLeft, ArrowRight } from 'lucide-react';

import { DIAGRAMS, type DiagramMeta } from '../diagrams';
import { Page } from '../ui/Page';
import { cn } from '../lib/cn';
import { href } from '../router';

const LINK =
  'inline-flex items-center gap-2xs rounded-md text-m text-on-canvas underline decoration-accent underline-offset-2 hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** The route segment a drawing answers on, which is the id it already carried. */
export function diagramRoute(id: string): string {
  return `/diagrams/${id}`;
}

/**
 * One drawing, on its own.
 *
 * The four of them used to be one page, nine screens tall, and looking at the
 * third meant scrolling past two. A drawing is a thing you go to and study, so
 * it gets an address, and the page around it holds nothing but that drawing, what
 * it is for, and the way to the next one.
 */
export function DiagramView({ meta }: { meta: DiagramMeta }) {
  const index = DIAGRAMS.findIndex((d) => d.id === meta.id);
  const previous = index > 0 ? DIAGRAMS[index - 1] : null;
  const next = index < DIAGRAMS.length - 1 ? DIAGRAMS[index + 1] : null;
  const { Figure } = meta;

  return (
    <Page>
      <nav aria-label="Breadcrumb" className="mb-sm text-s text-on-canvas-muted">
        <ol className="flex flex-wrap items-center gap-2xs">
          <li>
            <a className="hover:text-on-canvas" href={href('/handbook')}>
              Handbook
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a className="hover:text-on-canvas" href={href('/diagrams')}>
              Diagrams
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-on-canvas">
            {index + 1} of {DIAGRAMS.length}
          </li>
        </ol>
      </nav>

      <h1 className="max-w-content text-headline-xl font-semibold tracking-tight">{meta.title}</h1>
      <p className="mt-xs max-w-content text-l leading-normal text-on-canvas-muted">{meta.lede}</p>

      <Figure />

      <nav
        aria-label="The other diagrams"
        className="mt-2xl flex flex-wrap items-center justify-between gap-s border-t border-stroke pt-sm"
      >
        {previous ? (
          <a className={LINK} href={href(diagramRoute(previous.id))}>
            <ArrowLeft aria-hidden="true" className="size-[0.875rem]" />
            {previous.title}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a className={cn(LINK, 'ml-auto')} href={href(diagramRoute(next.id))}>
            {next.title}
            <ArrowRight aria-hidden="true" className="size-[0.875rem]" />
          </a>
        )}
      </nav>
    </Page>
  );
}
