import { useMemo, useState } from 'react';

import api from 'virtual:api';
import type { ApiModule, ApiSymbol } from 'virtual:api';
import { symbolId } from '../nav';
import { href } from '../router';
import { Slot } from '../shell/slots';
import { Disclosure, Filter, Source } from '../ui/Lookup';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';

const { modules: MODULES, package: PACKAGE } = api.core;

/**
 * The core's API, as a place to look something up rather than a site to read.
 *
 * TypeDoc produced this model with `--json` and nothing else. No HTML, no theme.
 * That was the whole reason for choosing it. A generated documentation site would
 * have arrived with its own navigation and its own design, and its pages would
 * have become the front door by accident, ahead of the hand-written architecture
 * pages that are the better way in. Here this site renders the model in its own
 * vocabulary, and the search palette reaches it.
 *
 * `packages/app-core` has no barrel on purpose, so a module IS the import path a
 * caller writes. Each heading prints that line verbatim, because "which subpath
 * do I import" is the question this page most often answers.
 *
 * The core only. The app's own components come out of the same script and are
 * rendered by `pages/Components.tsx`, one route along, because they are not a
 * library: they are reached by the `@/components` alias inside `apps/mobile` and
 * from nowhere else, and a reader who took the two pages for one would look for
 * `ui/Button` under a package that has never held a component. The furniture the
 * two share is in `ui/Lookup.tsx`.
 *
 * A symbol with no prose is shown and marked rather than hidden. The gap is worth
 * seeing: 167 of the core's 327 exported symbols carry a doc comment, and the
 * ones that do carry real arguments rather than restatements of their signature.
 *
 * The prose is HTML because the comments are Markdown and lean on backticks for
 * every identifier. The build renders it, from this repository's own source at the
 * commit being built, which is the same trust boundary as the documents.
 */
export function Reference() {
  const [query, setQuery] = useState('');
  const sections = useSections('/reference', true);

  const modules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.map((module) => {
      if (module.subpath.toLowerCase().includes(q)) return module;
      const symbols = module.symbols.filter((s) =>
        `${s.name} ${s.summary}`.toLowerCase().includes(q),
      );
      return symbols.length > 0 ? { ...module, symbols } : null;
    }).filter((m): m is ApiModule => m !== null);
  }, [query]);

  const symbolCount = modules.reduce((n, m) => n + m.symbols.length, 0);

  return (
    <>
      <Slot id="context-bar">
        <Filter
          id="ref-q"
          label="Filter modules and symbols"
          placeholder="Filter, for example loadArticle or stores/"
          value={query}
          onChange={setQuery}
          summary={`${modules.length} modules, ${symbolCount} symbols`}
        />
      </Slot>

      <Slot id="contents">
        <Toc headings={sections} />
      </Slot>

      <Page>
        <article className="min-w-0">
          <h1 className="text-headline-xl font-bold leading-tight tracking-tight">Reference</h1>
          <p className="mt-xs max-w-content text-m leading-relaxed text-on-canvas-muted">
            Every exported symbol in <code className="font-mono">packages/app-core</code>, extracted
            from the source and its doc comments. The core has no barrel, so a module here is the
            subpath you import. This is a lookup surface; the architecture pages are the way in. The
            app&apos;s own components are their own section:{' '}
            <a
              href={href('/components')}
              className="text-on-canvas underline decoration-accent underline-offset-2"
            >
              Components
            </a>
            , which nothing outside <code className="font-mono">apps/mobile</code> can import.
          </p>

          {modules.length === 0 && (
            <p className="py-2xl text-center text-m text-on-canvas-muted">Nothing matches that.</p>
          )}

          {modules.map((module) => (
            /* `mt`, not `mb`: the filter used to sit between the lede and the
             first module and carried the space with it. It is in the header now,
             so the first section has to bring its own. */
            <section className="mt-xl" key={module.subpath}>
              <h2
                id={`m-${module.subpath.replace(/\//g, '-')}`}
                className="scroll-mt-[4.75rem] font-mono text-headline-m font-semibold leading-tight wrap-anywhere"
              >
                {module.subpath}
              </h2>
              <p className="mt-3xs break-words font-mono text-s text-on-canvas-muted">
                {`import … from '${PACKAGE}/${module.subpath}'`}
              </p>
              {module.doc && (
                <div
                  className="prose prose-sm mt-s max-w-content"
                  dangerouslySetInnerHTML={{ __html: module.doc }}
                />
              )}

              <ul className="mt-s divide-y divide-stroke overflow-hidden rounded-md border border-stroke">
                {module.symbols.map((symbol) => (
                  <li key={symbol.name}>
                    <Symbol module={module} symbol={symbol} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      </Page>
    </>
  );
}

/** One symbol: what kind of thing it is, its signature and its prose. */
function Symbol({ module, symbol }: { module: ApiModule; symbol: ApiSymbol }) {
  return (
    <Disclosure
      id={symbolId(module.subpath, symbol.name)}
      summary={
        <>
          <span className="hidden w-[4.5rem] shrink-0 font-mono text-s text-on-canvas-muted sm:block">
            {symbol.kind}
          </span>
          <span className="shrink-0 font-mono text-m font-semibold">{symbol.name}</span>
          <span className="min-w-0 flex-1 truncate text-s text-on-canvas-muted">
            {symbol.summary || <span className="italic">No doc comment.</span>}
          </span>
        </>
      }
    >
      {symbol.signature && (
        <p className="whitespace-pre-wrap break-words font-mono text-s">{symbol.signature}</p>
      )}
      {symbol.doc && (
        <div
          className="prose prose-sm mt-s max-w-content"
          dangerouslySetInnerHTML={{ __html: symbol.doc }}
        />
      )}
      <Source file={module.file} line={symbol.line} />
    </Disclosure>
  );
}
