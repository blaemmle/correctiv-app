import { useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/cn';
import type { Heading } from '../../plugin/markdown.ts';

interface Props {
  headings: Heading[];
}

/**
 * The in-page contents, following the heading currently on screen.
 *
 * It has no chrome of its own: the shell puts it inside the right sidebar, which
 * already carries the title and the way to shut it.
 *
 * Only h2 and h3. An h4 in these documents is a detail inside an argument, and
 * listing them turns a map into a transcript. The observer's top margin keeps a
 * heading current while its section is being read rather than only while the
 * heading itself is visible.
 */
export function Toc({ headings }: Props) {
  const shown = useMemo(() => headings.filter((h) => h.depth === 2 || h.depth === 3), [headings]);
  const [active, setActive] = useState<string | null>(shown[0]?.id ?? null);

  useEffect(() => {
    if (shown.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    for (const heading of shown) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [shown]);

  /*
   * A map of one heading is not a map. The section still exists, because the
   * route declared it, so it says what it has rather than leaving an empty box
   * behind a title.
   */
  if (shown.length < 2) {
    return <p className="p-s text-s text-on-canvas-muted">No headings on this page.</p>;
  }

  return (
    <nav aria-label="On this page" className="p-s">
      <ul className="space-y-3xs text-m">
        {shown.map((heading) => (
          <li key={heading.id} className={heading.depth === 3 ? 'pl-s' : undefined}>
            <a
              href={`#${heading.id}`}
              aria-current={heading.id === active ? 'true' : undefined}
              className={cn(
                'block rounded-md py-4xs leading-snug',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                heading.id === active
                  ? 'font-medium text-on-canvas'
                  : 'text-on-canvas-muted hover:text-on-canvas',
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
