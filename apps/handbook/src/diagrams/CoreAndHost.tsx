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
      viewBox="0 0 960 710"
      className={cn(DRAWING, 'block h-[710px] w-[960px] max-w-none')}
      aria-labelledby="d1-title"
      aria-describedby={alt ? 'd1-alt' : undefined}
    >
      <title id="d1-title">
        The core and its host: packages/app-core above, apps/mobile below, joined only by four ports
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

      <rect x="40" y="28" width="880" height="190" rx="8" className={BOX_CORE} />
      <text x="60" y="56" className={cn(MONO, BOLD, T16)}>
        packages/app-core
      </text>
      <text x="900" y="56" textAnchor="end" className={cn(MUTED, T12)}>
        behaviour, all of it
      </text>
      {/*
        The directories of `packages/app-core/src`, in the order the fourth drawing
        stacks them, so the two agree. There are eight slots and nine directories:
        `ui` is one file of icon names and is the one left out.
      */}
      <g className={cn(MONO, T12)}>
        <rect x="60" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="108" y="98" textAnchor="middle">
          stores
        </text>
        <rect x="166" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="214" y="98" textAnchor="middle">
          articles
        </text>
        <rect x="272" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="320" y="98" textAnchor="middle">
          media
        </text>
        <rect x="378" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="426" y="98" textAnchor="middle">
          services
        </text>
        <rect x="484" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="532" y="98" textAnchor="middle">
          data
        </text>
        <rect x="590" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="638" y="98" textAnchor="middle">
          lib
        </text>
        <rect x="696" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="744" y="98" textAnchor="middle">
          ports
        </text>
        <rect x="802" y="84" width="96" height="28" rx="6" className={CHIP} />
        <text x="850" y="98" textAnchor="middle">
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

      <line x1="150" y1="218" x2="150" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="370" y1="218" x2="370" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="590" y1="218" x2="590" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="810" y1="218" x2="810" y2="254" className={WIRE} markerEnd="url(#d1-arrow)" />
      <text x="600" y="236" className={cn(T11, MUTED)}>
        the core calls
      </text>

      <rect x="45" y="250" width="430" height="214" rx="10" className={DASHED} />
      <text x="260" y="250" textAnchor="middle" className={cn(T11, MUTED, HALO)}>
        storage ports
      </text>

      <g className={T12}>
        <rect x="55" y="258" width="190" height="198" rx="8" className={CARD} />
        <text x="150" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          KeyValueStore
        </text>
        <line x1="55" y1="298" x2="245" y2="298" className={RULE} />
        <text x="150" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="150" y="338" textAnchor="middle">
          small settings,
        </text>
        <text x="150" y="355" textAnchor="middle">
          asynchronously
        </text>
        <text x="150" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="150" y="408" textAnchor="middle">
          MMKV, one store the
        </text>
        <text x="150" y="425" textAnchor="middle">
          cache cannot reach
        </text>

        <rect x="275" y="258" width="190" height="198" rx="8" className={CARD} />
        <text x="370" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          BlobStore
        </text>
        <line x1="275" y1="298" x2="465" y2="298" className={RULE} />
        <text x="370" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="370" y="338" textAnchor="middle">
          the HTTP cache,
        </text>
        <text x="370" y="355" textAnchor="middle">
          asynchronously
        </text>
        <text x="370" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="370" y="408" textAnchor="middle">
          a second MMKV store,
        </text>
        <text x="370" y="425" textAnchor="middle">
          bounded and evictable
        </text>

        <rect x="495" y="258" width="190" height="198" rx="8" className={CARD} />
        <text x="590" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          ContentBundle
        </text>
        <line x1="495" y1="298" x2="685" y2="298" className={RULE} />
        <text x="590" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="590" y="338" textAnchor="middle">
          what shipped inside the app
        </text>
        <text x="590" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="590" y="408" textAnchor="middle">
          generated TS modules
        </text>

        <rect x="715" y="258" width="190" height="198" rx="8" className={CARD} />
        <text x="810" y="280" textAnchor="middle" className={cn(MONO, BOLD, T13)}>
          AudioBackend
        </text>
        <line x1="715" y1="298" x2="905" y2="298" className={RULE} />
        <text x="810" y="318" textAnchor="middle" className={cn(T11, MUTED)}>
          the core needs
        </text>
        <text x="810" y="338" textAnchor="middle">
          playback, as status ticks
        </text>
        <text x="810" y="388" textAnchor="middle" className={cn(T11, MUTED)}>
          this host answers with
        </text>
        <text x="810" y="408" textAnchor="middle">
          expo-audio's status events
        </text>
      </g>

      <text x="260" y="476" textAnchor="middle" className={cn(T11, MUTED)}>
        both asynchronous, split only
      </text>
      <text x="260" y="490" textAnchor="middle" className={cn(T11, MUTED)}>
        by what they hold, a settings
      </text>
      <text x="260" y="504" textAnchor="middle" className={cn(T11, MUTED)}>
        string against a megabyte of feeds
      </text>

      <line x1="150" y1="520" x2="150" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="370" y1="520" x2="370" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="590" y1="520" x2="590" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <line x1="810" y1="520" x2="810" y2="460" className={WIRE} markerEnd="url(#d1-arrow)" />
      <text x="600" y="490" className={cn(T11, MUTED)}>
        the host implements
      </text>

      <rect x="40" y="520" width="880" height="170" rx="8" className={BOX} />
      <rect x="41" y="521" width="878" height="34" rx="7" className={BAND} />
      <line x1="40" y1="556" x2="920" y2="556" className={RULE_STRONG} />
      {/*
        Two files, not one. `expo.ts` answers three of the ports; the audio one is
        answered in `lib/audio/backend.ts` and composed onto the other three at the
        boot site, so that reasoning about where state is stored does not drag in an
        audio SDK. `expo.ts` says as much in its own closing comment.
      */}
      <text x="480" y="538" textAnchor="middle" className={T12}>
        <tspan className={MUTED}>adapter </tspan>
        <tspan className={cn(MONO, BOLD)}>lib/platform/expo.ts</tspan>
        <tspan className={MUTED}> and </tspan>
        <tspan className={cn(MONO, BOLD)}>lib/audio/backend.ts</tspan>
        <tspan className={MUTED}>, the whole cost of adding a host</tspan>
      </text>
      <text x="60" y="592" className={cn(MONO, BOLD, T16)}>
        apps/mobile
      </text>
      <text x="900" y="592" textAnchor="end" className={cn(MUTED, T12)}>
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
 * cannot use the drawing, and it stays. Inside `ARCHITECTURE.md` the four ports
 * are named in a paragraph and again in a table, so the drawing there is
 * described by the document and the list comes off. The `<title>` inside the SVG
 * names it either way.
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
        The core declares the four interfaces and calls them, and a test keeps the line from moving.
        This host answers three of them in <code>apps/mobile/src/lib/platform/expo.ts</code> and the
        fourth in <code>apps/mobile/src/lib/audio/backend.ts</code>, which{' '}
        <code>apps/mobile/src/app/_layout.tsx</code> composes onto the other three. Adding a second
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
            <dt>Four ports, the only crossing between the two</dt>
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
              </ul>
              Both storage ports are asynchronous. What separates them is what they hold, a settings
              string against a megabyte of cached feeds.
            </dd>
            <dt>The adapter</dt>
            <dd>
              <code>apps/mobile/src/lib/platform/expo.ts</code> answers the three storage and
              content ports. <code>apps/mobile/src/lib/audio/backend.ts</code> answers the fourth,
              and <code>apps/mobile/src/app/_layout.tsx</code> composes it onto the other three, so
              that reasoning about where state is stored does not drag in an audio SDK. Those two
              files are the whole cost of adding a host.
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
