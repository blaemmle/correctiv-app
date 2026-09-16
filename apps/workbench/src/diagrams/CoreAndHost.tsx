import { cn } from '../lib/cn';
import {
  ALT,
  BAND,
  BOLD,
  BOX,
  BOX_CORE,
  CAPTION,
  CARD,
  CHIP,
  DASHED,
  DRAWING,
  FIGURE,
  HALO,
  MARKER,
  MONO,
  MUTED,
  RULE,
  RULE_STRONG,
  SCROLL_BOX,
  T11,
  T12,
  T13,
  T16,
  WIRE,
} from './shared';

/**
 * The drawing alone, without the box that scrolls it or the list beside it.
 *
 * Split out because a page may want the picture and nothing else, and because
 * the ids inside it are referenced from outside, so they are part of what it is.
 * `alt` reaches this far in only to decide whether the drawing points at a list
 * that may not be on the page.
 */
/**
 * The drawing on its own, with no description attached by default.
 *
 * `alt` is off here and on in the figure, and that asymmetry is the point: the
 * description it names lives in the figure, so a drawing rendered by itself,
 * as a thumbnail on `/diagrams`, would be pointing at an element that is not on
 * the page.
 */
export function CoreAndHostDrawing({ alt = false }: { alt?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 1100 710"
      className={cn(DRAWING, 'block h-[710px] w-[1100px] max-w-none')}
      aria-labelledby="d1-title"
      aria-describedby={alt ? 'd1-alt' : undefined}
    >
      <title id="d1-title">
        The core and its host: packages/app-core above, apps/mobile below, joined only by five ports
      </title>
      <defs>
        <marker
          id="d1-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" className={MARKER} />
        </marker>
      </defs>

      <rect x="40" y="28" width="1020" height="190" rx="8" className={BOX_CORE} />
      <text x="60" y="56" className={cn(MONO, BOLD, T16)}>
        packages/app-core
      </text>
      <text x="1040" y="56" textAnchor="end" className={cn(MUTED, T12)}>
        behaviour, all of it
      </text>
      {/*
        The directories of `packages/app-core/src` that the fourth drawing stacks,
        in the same order, so the two agree. `i18n` is the one directory neither
        drawing has a slot for: it is the core's own message descriptors, and what
        it holds is words rather than a layer.
      */}
      <g className={cn(MONO, T12)}>
        <rect x="60" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="114" y="98" textAnchor="middle">
          stores
        </text>
        <rect x="184" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="238" y="98" textAnchor="middle">
          articles
        </text>
        <rect x="308" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="362" y="98" textAnchor="middle">
          media
        </text>
        <rect x="432" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="486" y="98" textAnchor="middle">
          services
        </text>
        <rect x="556" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="610" y="98" textAnchor="middle">
          data
        </text>
        <rect x="680" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="734" y="98" textAnchor="middle">
          lib
        </text>
        <rect x="804" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="858" y="98" textAnchor="middle">
          ports
        </text>
        <rect x="928" y="84" width="108" height="28" rx="6" className={CHIP} />
        <text x="982" y="98" textAnchor="middle">
          types
        </text>
      </g>
      <text x="60" y="146" className={cn(T13, BOLD)}>
        Imports no UI framework and no platform SDK. That rule is what gives the package its value.
      </text>
      <text x="60" y="176" className={cn(T12, MUTED)}>
        <tspan className={MONO}>packages/app-core/test/boundary.test.ts</tspan> fails the build if a
        platform import ever appears.
      </text>

      <line x1="141" y1="218" x2="141" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="335" y1="218" x2="335" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="529" y1="218" x2="529" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="723" y1="218" x2="723" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="959" y1="218" x2="959" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <text x="545" y="236" className={cn(T11, MUTED)}>
        the core calls
      </text>
      {/*
        The fifth arrow gets a verb of its own, because the fifth port is not a
        thing the core needs in order to work. The gap in front of its card and
        this label are the two places the drawing says so; the card itself says
        what it means.
      */}
      <text x="947" y="236" textAnchor="end" className={cn(T11, MUTED)}>
        the core reports
      </text>

      <rect x="45" y="250" width="386" height="214" rx="10" className={DASHED} />
      <text x="238" y="250" textAnchor="middle" className={cn(T11, MUTED, HALO)}>
        storage ports
      </text>

      <g className={T12}>
        <rect x="55" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="141" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          KeyValueStore
        </text>
        <line x1="55" y1="298" x2="227" y2="298" className={RULE} />
        <text x="141" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="141" y="338" textAnchor="middle">
          small settings,
        </text>
        <text x="141" y="355" textAnchor="middle">
          asynchronously
        </text>
        <text x="141" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="141" y="408" textAnchor="middle">
          MMKV, one store the
        </text>
        <text x="141" y="425" textAnchor="middle">
          cache cannot reach
        </text>

        <rect x="249" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="335" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          BlobStore
        </text>
        <line x1="249" y1="298" x2="421" y2="298" className={RULE} />
        <text x="335" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="335" y="338" textAnchor="middle">
          the HTTP cache,
        </text>
        <text x="335" y="355" textAnchor="middle">
          asynchronously
        </text>
        <text x="335" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="335" y="408" textAnchor="middle">
          a second MMKV store,
        </text>
        <text x="335" y="425" textAnchor="middle">
          bounded and evictable
        </text>

        <rect x="443" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="529" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          ContentBundle
        </text>
        <line x1="443" y1="298" x2="615" y2="298" className={RULE} />
        <text x="529" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="529" y="338" textAnchor="middle">
          what shipped inside
        </text>
        <text x="529" y="355" textAnchor="middle">
          the app
        </text>
        <text x="529" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="529" y="408" textAnchor="middle">
          generated TS modules
        </text>

        <rect x="637" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="723" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          AudioBackend
        </text>
        <line x1="637" y1="298" x2="809" y2="298" className={RULE} />
        <text x="723" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="723" y="338" textAnchor="middle">
          playback, as
        </text>
        <text x="723" y="355" textAnchor="middle">
          status ticks
        </text>
        <text x="723" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="723" y="408" textAnchor="middle">
          expo-audio's
        </text>
        <text x="723" y="425" textAnchor="middle">
          status events
        </text>

        {/*
          The fifth card, and the gap in front of it is the drawing's whole
          argument about it: the four to its left are what the core needs in
          order to WORK, and this one is what it needs in order to be HEARD. It
          keeps the two-half grammar of the others, because it is a port like
          them and the host answers it the same way, and the top half is where
          the difference is said.
        */}
        <rect x="873" y="258" width="172" height="198" rx="8" className={CARD} />
        <text x="959" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          ErrorReporter
        </text>
        <line x1="873" y1="298" x2="1045" y2="298" className={RULE} />
        <text x="959" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="959" y="338" textAnchor="middle">
          to be heard: a fault
        </text>
        <text x="959" y="355" textAnchor="middle">
          no screen shows
        </text>
        <text x="959" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="959" y="408" textAnchor="middle">
          one log line, and no
        </text>
        <text x="959" y="425" textAnchor="middle">
          provider chosen yet
        </text>
      </g>

      {/*
        Four lines at twelve rather than three at fourteen. The note has to clear
        the dashed frame above it and the host box below it, and stay inside the
        194 units between the two arrows either side of it; the old third line was
        wide enough to run through both arrows once the cards narrowed.
      */}
      <text x="238" y="476" textAnchor="middle" className={cn(T11, MUTED)}>
        both asynchronous, split only
      </text>
      <text x="238" y="488" textAnchor="middle" className={cn(T11, MUTED)}>
        by what they hold, a settings
      </text>
      <text x="238" y="500" textAnchor="middle" className={cn(T11, MUTED)}>
        string against a megabyte
      </text>
      <text x="238" y="512" textAnchor="middle" className={cn(T11, MUTED)}>
        of cached feeds
      </text>

      <line x1="141" y1="520" x2="141" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="335" y1="520" x2="335" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="529" y1="520" x2="529" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="723" y1="520" x2="723" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="959" y1="520" x2="959" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      {/*
        One label for all five arrows up, and no second verb down here: the host
        implements the fifth port exactly as it implements the other four. The
        difference is in what the CORE does with it, which is why the drawing
        only splits the labels on the way down. That the host's own error
        boundary then calls that implementation is a fact about the host's
        inside and never crosses this line, so it is in the caption, not drawn.
      */}
      <text x="545" y="490" className={cn(T11, MUTED)}>
        the host implements
      </text>

      <rect x="40" y="520" width="1020" height="170" rx="8" className={BOX} />
      <rect x="41" y="521" width="1018" height="34" rx="7" className={BAND} />
      <line x1="40" y1="556" x2="1060" y2="556" className={RULE_STRONG} />
      {/*
        Two files, not one. `expo.ts` answers four of the ports; the audio one is
        answered in `lib/audio/backend.ts` and composed onto the other four at the
        boot site, so that reasoning about where state is stored does not drag in an
        audio SDK. `expo.ts` says as much in its own closing comment.
      */}
      <text x="550" y="538" textAnchor="middle" className={T12}>
        <tspan className={MUTED}>adapter </tspan>
        <tspan className={cn(MONO, BOLD)}>lib/platform/expo.ts</tspan>
        <tspan className={MUTED}> and </tspan>
        <tspan className={cn(MONO, BOLD)}>lib/audio/backend.ts</tspan>
        <tspan className={MUTED}>, the whole cost of adding a host</tspan>
      </text>
      <text x="60" y="592" className={cn(MONO, BOLD, T16)}>
        apps/mobile
      </text>
      <text x="1040" y="592" textAnchor="end" className={cn(MUTED, T12)}>
        the host, all of the platform
      </text>
      <text x="60" y="622" className={T13}>
        Expo / React Native
      </text>
      <text x="60" y="648" className={cn(T13, MUTED)}>
        targets iOS, Android and web
      </text>
    </svg>
  );
}

/**
 * The first drawing: where the behaviour ends and the platform begins.
 *
 * It sits in its own file because more than one page shows it, and the ids it
 * carries are referenced from outside, so they are part of what it is.
 *
 * `alt` is off where the page around the drawing already says the same thing in
 * prose. On `/diagrams` the list is not a caption, it is the page for anyone who
 * cannot use the drawing, and it stays. Inside `ARCHITECTURE.md` the ports are
 * named in a paragraph and again in a table, so the drawing there is described by
 * the document and the list comes off. The `<title>` inside the SVG names it
 * either way.
 */
export function CoreAndHost({ alt = true }: { alt?: boolean }) {
  return (
    <figure className={FIGURE}>
      {/*
        A named section, because that is what a landmark for a scrollable box
        is spelled as in HTML, and an `<svg>` with no role, because that
        element already carries the graphics-document role that a diagram
        wants. The name and the description come from the title inside it and
        the list below it, so the drawing is never the only way to read this.
      */}
      <section className={SCROLL_BOX} aria-label="Diagram 1, scrollable" tabIndex={0}>
        <CoreAndHostDrawing alt={alt} />
      </section>
      <figcaption className={CAPTION}>
        <strong>
          Everything that behaves lives above the ports; everything that touches a platform lives
          below them.
        </strong>{' '}
        The core declares the five interfaces and calls them, and a test keeps the line from moving.
        Four of them it needs in order to work. <code>ErrorReporter</code> it needs in order to be
        heard: its default reports nowhere, nothing waits for the call, and an unconfigured core
        goes quiet rather than breaking. This host answers four of them in{' '}
        <code>apps/mobile/src/lib/platform/expo.ts</code> and the audio one in{' '}
        <code>apps/mobile/src/lib/audio/backend.ts</code>, which{' '}
        <code>apps/mobile/src/app/_layout.tsx</code> composes onto the other four. Adding a second
        host means writing those two files again.
      </figcaption>
      {alt && (
        <div className={ALT} id="d1-alt">
          <h3>The same diagram as a list</h3>
          <dl>
            <dt>
              <code>packages/app-core</code>, the behaviour
            </dt>
            <dd>
              Holds stores, articles, media, services, data, lib, ports and types. It imports no UI
              framework and no platform SDK. <code>packages/app-core/test/boundary.test.ts</code>{' '}
              fails the build on an import matching its list.
            </dd>
            <dt>Five ports, the only crossing between the two</dt>
            <dd>
              <ul>
                <li>
                  <code>KeyValueStore</code>: the core needs small settings, asynchronously. This
                  host answers with MMKV, in the store that holds what the reader chose.
                </li>
                <li>
                  <code>BlobStore</code>: the core needs the HTTP cache, asynchronously. This host
                  answers with a second MMKV store, which the core's cache bounds and evicts from.
                  Two stores rather than one is what makes eviction unable to reach a bookmark.
                </li>
                <li>
                  <code>ContentBundle</code>: the core needs what shipped inside the app. This host
                  answers with generated TS modules.
                </li>
                <li>
                  <code>AudioBackend</code>: the core needs playback, as status ticks. This host
                  answers with expo-audio's status events.
                </li>
                <li>
                  <code>ErrorReporter</code>: the core needs to be heard, for a fault no screen
                  shows. This host answers with one log line, and no provider is chosen yet. It is
                  the one the core does not need in order to work, which is why its default reports
                  nowhere and why the call returns nothing for anyone to wait on. The host's own
                  error boundary reports through the same implementation, but it reaches it directly
                  rather than across this line.
                </li>
              </ul>
              Both storage ports are asynchronous. What separates them is what they hold, a settings
              string against a megabyte of cached feeds.
            </dd>
            <dt>The adapter</dt>
            <dd>
              <code>apps/mobile/src/lib/platform/expo.ts</code> answers four of them: the two
              storage interfaces, the content bundle and the reporter.{' '}
              <code>apps/mobile/src/lib/audio/backend.ts</code> answers the audio one, and{' '}
              <code>apps/mobile/src/app/_layout.tsx</code> composes it onto the other four, so that
              reasoning about where state is stored does not drag in an audio SDK. Those two files
              are the whole cost of adding a host.
            </dd>
            <dt>
              <code>apps/mobile</code>, the host
            </dt>
            <dd>Expo / React Native, targeting iOS, Android and web.</dd>
          </dl>
        </div>
      )}
    </figure>
  );
}
