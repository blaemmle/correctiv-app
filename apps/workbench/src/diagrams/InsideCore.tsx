import { cn } from '../lib/cn';
import {
  ALT,
  BOLD,
  BOUNDARY,
  BOX,
  BOX_CORE,
  CALLOUT,
  CAPTION,
  CHIP,
  CHIP_PORT,
  DRAWING,
  FIGURE,
  GHOST,
  LEAD,
  MARKER,
  MONO,
  MUTED,
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
export function InsideCoreDrawing({ alt = false }: { alt?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 1040 746"
      className={cn(DRAWING, 'block h-[746px] w-[1040px] max-w-none')}
      aria-labelledby="d3-title"
      aria-describedby={alt ? 'd3-alt' : undefined}
    >
      <title id="d3-title">
        Inside packages/app-core: stores over articles and media, over services and data, over lib,
        over the ports and types, with a hard boundary below and the platform SDKs on the far side
        of it
      </title>
      <defs>
        <marker
          id="d3-arrow"
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

      <line x1="22" y1="84" x2="22" y2="592" className={WIRE} markerEnd="url(#d3-arrow)" />
      <text
        transform="rotate(-90 10 338)"
        x="10"
        y="338"
        textAnchor="middle"
        className={cn(T11, MUTED)}
      >
        imports point down the stack
      </text>

      <rect x="40" y="28" width="680" height="584" rx="8" className={BOX_CORE} />
      <text x="60" y="56" className={cn(MONO, BOLD, T16)}>
        packages/app-core
      </text>
      <text x="700" y="56" textAnchor="end" className={cn(MUTED, T12)}>
        55 TypeScript files
      </text>

      <rect x="56" y="80" width="648" height="84" rx="6" className={CHIP} />
      <text x="72" y="100" className={cn(MONO, BOLD, T13)}>
        stores
      </text>
      <text x="140" y="100" className={cn(T12, MUTED)}>
        one Redux Toolkit store, 12 slices
      </text>
      <text x="72" y="126" className={T12}>
        The core owns the slices and exports <tspan className={MONO}>createAppStore()</tspan>.
      </text>
      <text x="72" y="146" className={T12}>
        The host constructs the instance.
      </text>

      <rect x="56" y="180" width="440" height="110" rx="6" className={CHIP} />
      <text x="72" y="200" className={cn(MONO, BOLD, T13)}>
        articles
      </text>
      <text x="150" y="200" className={cn(T12, MUTED)}>
        the Article model and its load cascade
      </text>
      <text x="72" y="236" className={cn(MONO, T11, MUTED)}>
        articles/extract
      </text>
      <rect x="72" y="250" width="56" height="24" rx="5" className={BOX} />
      <text x="100" y="262" textAnchor="middle" className={cn(MONO, T12)}>
        string
      </text>
      <rect x="136" y="250" width="46" height="24" rx="5" className={BOX} />
      <text x="159" y="262" textAnchor="middle" className={cn(MONO, T12)}>
        DOM
      </text>
      <text x="194" y="262" className={T12}>
        two backends behind one <tspan className={MONO}>ArticleExtractor</tspan>
      </text>

      <rect x="512" y="180" width="192" height="110" rx="6" className={CHIP} />
      <text x="528" y="200" className={cn(MONO, BOLD, T13)}>
        media
      </text>
      <text x="528" y="230" className={T12}>
        one rule:
      </text>
      <text x="528" y="248" className={T12}>
        only one medium
      </text>
      <text x="528" y="266" className={T12}>
        plays at a time
      </text>

      <rect x="56" y="306" width="440" height="110" rx="6" className={CHIP} />
      <text x="72" y="326" className={cn(MONO, BOLD, T13)}>
        services
      </text>
      <text x="150" y="326" className={cn(T12, MUTED)}>
        10 files
      </text>
      <g className={cn(MONO, T12)}>
        <rect x="72" y="344" width="44" height="24" rx="5" className={BOX} />
        <text x="94" y="356" textAnchor="middle">
          auth
        </text>
        <rect x="122" y="344" width="52" height="24" rx="5" className={BOX} />
        <text x="148" y="356" textAnchor="middle">
          cache
        </text>
        <rect x="180" y="344" width="44" height="24" rx="5" className={BOX} />
        <text x="202" y="356" textAnchor="middle">
          http
        </text>
        <rect x="230" y="344" width="74" height="24" rx="5" className={BOX} />
        <text x="267" y="356" textAnchor="middle">
          peertube
        </text>
        <rect x="310" y="344" width="66" height="24" rx="5" className={BOX} />
        <text x="343" y="356" textAnchor="middle">
          podcast
        </text>
        <rect x="72" y="380" width="52" height="24" rx="5" className={BOX} />
        <text x="98" y="392" textAnchor="middle">
          radio
        </text>
        <rect x="130" y="380" width="36" height="24" rx="5" className={BOX} />
        <text x="148" y="392" textAnchor="middle">
          rss
        </text>
        <rect x="172" y="380" width="58" height="24" rx="5" className={BOX} />
        <text x="201" y="392" textAnchor="middle">
          search
        </text>
        <rect x="236" y="380" width="80" height="24" rx="5" className={BOX} />
        <text x="276" y="392" textAnchor="middle">
          spotlight
        </text>
        <rect x="322" y="380" width="30" height="24" rx="5" className={BOX} />
        <text x="337" y="392" textAnchor="middle">
          wp
        </text>
      </g>

      <rect x="512" y="306" width="192" height="110" rx="6" className={CHIP} />
      <text x="528" y="326" className={cn(MONO, BOLD, T13)}>
        data
      </text>
      <text x="580" y="326" className={cn(T12, MUTED)}>
        11 files
      </text>
      <text x="528" y="356" className={T12}>
        typed content,
      </text>
      <text x="528" y="374" className={T12}>
        checked by the compiler
      </text>

      <rect x="56" y="432" width="648" height="44" rx="6" className={CHIP} />
      <text x="72" y="454" className={cn(MONO, BOLD, T13)}>
        lib
      </text>
      <text x="120" y="454" className={T12}>
        dependency-free string and date helpers
      </text>

      {/*
        The bottom layer is two directories, so it is drawn the way the two rows
        above it are: a wide chip and a narrow one. `types` used to be a pair of
        right-aligned labels floating inside the ports chip, which put "the shared
        contracts" straight through `configurePlatform()` at every width.

        Two rows of chips inside `ports`, and the break between them is the point.
        The four on the first row are what the core needs in order to WORK.
        `ErrorReporter` is on its own because it is what the core needs in order
        to be HEARD: the app runs without it, which is exactly why its default
        can report nowhere. `configurePlatform()` keeps it company because it is
        the one thing in this file that is not an interface.
      */}
      <rect x="56" y="492" width="440" height="104" rx="6" className={CHIP} />
      <text x="72" y="512" className={cn(MONO, BOLD, T13)}>
        ports
      </text>
      <text x="128" y="512" className={cn(MONO, T11, MUTED)}>
        ports/index.ts, 1 file
      </text>
      <text x="480" y="512" textAnchor="end" className={cn(T11, MUTED)}>
        four to work, one to be heard
      </text>
      <g className={cn(MONO, T12)}>
        <rect x="72" y="528" width="106" height="24" rx="5" className={CHIP_PORT} />
        <text x="125" y="540" textAnchor="middle">
          KeyValueStore
        </text>
        <rect x="184" y="528" width="78" height="24" rx="5" className={CHIP_PORT} />
        <text x="223" y="540" textAnchor="middle">
          BlobStore
        </text>
        <rect x="268" y="528" width="106" height="24" rx="5" className={CHIP_PORT} />
        <text x="321" y="540" textAnchor="middle">
          ContentBundle
        </text>
        <rect x="380" y="528" width="98" height="24" rx="5" className={CHIP_PORT} />
        <text x="429" y="540" textAnchor="middle">
          AudioBackend
        </text>
        <rect x="72" y="560" width="106" height="24" rx="5" className={CHIP_PORT} />
        <text x="125" y="572" textAnchor="middle">
          ErrorReporter
        </text>
        <rect x="184" y="560" width="148" height="24" rx="5" className={BOX} />
        <text x="258" y="572" textAnchor="middle">
          configurePlatform()
        </text>
      </g>

      <rect x="512" y="492" width="192" height="104" rx="6" className={CHIP} />
      <text x="528" y="512" className={cn(MONO, BOLD, T13)}>
        types
      </text>
      <text x="580" y="512" className={cn(T12, MUTED)}>
        1 file
      </text>
      <text x="528" y="542" className={T12}>
        the shared contracts
      </text>

      <line x1="40" y1="636" x2="720" y2="636" className={BOUNDARY} />
      <text x="40" y="658" className={cn(T12, BOLD)}>
        hard boundary, nothing crosses it
      </text>
      {/*
        The test matches a list of names, not the region of this drawing. Its
        patterns are anchored at the start of the import, so `react-native`,
        `react-native-mmkv` and `expo-audio` are all caught. Saying "anything
        below" made the drawing promise more than the test.
      */}
      <text x="40" y="676" className={cn(T12, MUTED)}>
        <tspan className={MONO}>packages/app-core/test/boundary.test.ts</tspan> fails the build on
        an import matching its list: react-native, expo, node built-ins
      </text>
      <g className={cn(MONO, T12, MUTED)}>
        <rect x="40" y="696" width="100" height="30" rx="6" className={GHOST} />
        <text x="90" y="711" textAnchor="middle">
          react-native
        </text>
        <rect x="150" y="696" width="50" height="30" rx="6" className={GHOST} />
        <text x="175" y="711" textAnchor="middle">
          expo
        </text>
        <rect x="210" y="696" width="90" height="30" rx="6" className={GHOST} />
        <text x="255" y="711" textAnchor="middle">
          expo-audio
        </text>
        <rect x="310" y="696" width="150" height="30" rx="6" className={GHOST} />
        <text x="385" y="711" textAnchor="middle">
          react-native-mmkv
        </text>
      </g>
      <text x="476" y="711" className={cn(T11, MUTED)}>
        platform SDKs, reached by the host only
      </text>

      <rect x="740" y="80" width="280" height="84" rx="6" className={CALLOUT} />
      <line x1="740" y1="122" x2="704" y2="122" className={LEAD} />
      <text x="754" y="102" className={cn(T11, MUTED)}>
        convention
      </text>
      <text x="754" y="122" className={T12}>
        Derived values are exported selectors
      </text>
      <text x="754" y="140" className={T12}>
        taking state, never store methods.
      </text>

      <rect x="740" y="492" width="280" height="104" rx="6" className={CALLOUT} />
      <line x1="740" y1="544" x2="704" y2="544" className={LEAD} />
      <text x="754" y="514" className={cn(T11, MUTED)}>
        convention
      </text>
      <text x="754" y="534" className={T12}>
        Subpath imports, no barrel:
      </text>
      <text x="754" y="554" className={cn(MONO, T11)}>
        @correctiv/app-core/stores/session
      </text>
      <text x="754" y="574" className={T12}>
        The root entry exposes only the ports.
      </text>
    </svg>
  );
}

/**
 * The fourth drawing: how the core is layered inside, and the line below it that
 * nothing in the package crosses.
 *
 * The list under it is not a caption, it is the page for anyone who cannot use
 * the drawing, and `aria-describedby` points at it, which is why the ids here
 * have to stay as they are.
 */
export function InsideCore({ alt = true }: { alt?: boolean }) {
  return (
    <figure className={FIGURE}>
      {/*
        Fourth, because `diagrams/index.ts` orders it fourth and `DiagramView` counts
        the breadcrumb off that same array. The `d3-` ids inside the drawing are
        older and are only ever read by `aria-labelledby`, so they are left alone.
      */}
      <section className={SCROLL_BOX} aria-label="Diagram 4, scrollable" tabIndex={0}>
        <InsideCoreDrawing alt={alt} />
      </section>
      <figcaption className={CAPTION}>
        <strong>Every layer imports downward, and the lowest one is a set of interfaces.</strong>{' '}
        The ports are declared here and implemented outside; the SDKs under the red line are the
        host's business, and a test keeps them out. The root entry exports only the ports, so a host
        reaches anything else by its path.
      </figcaption>
      {alt && (
        <div className={ALT} id="d3-alt">
          <h3>The same diagram as a list</h3>
          <p>
            <code>packages/app-core</code>, 55 TypeScript files. Imports point down the stack.
            Layers from the top:
          </p>
          <ol>
            <li>
              <strong>stores</strong>: one Redux Toolkit store with 12 slices. The core owns the
              slices and exports <code>createAppStore()</code>; the host constructs the instance.
            </li>
            <li>
              <strong>articles</strong>: the Article model and its load cascade.{' '}
              <code>articles/extract</code> holds two backends, a string one and a DOM one, behind
              one <code>ArticleExtractor</code> type. Beside it, <strong>media</strong>, with one
              rule: only one medium plays at a time.
            </li>
            <li>
              <strong>services</strong>, 10 files: auth, cache, http, peertube, podcast, radio, rss,
              search, spotlight, wp. Beside it, <strong>data</strong>, 11 files of typed content.
            </li>
            <li>
              <strong>lib</strong>: dependency-free string and date helpers.
            </li>
            <li>
              <strong>ports</strong> and <strong>types</strong>, the contracts:{' '}
              <code>ports/index.ts</code>, one file, declares <code>KeyValueStore</code>,{' '}
              <code>BlobStore</code>, <code>ContentBundle</code>, <code>AudioBackend</code>,{' '}
              <code>ErrorReporter</code> and <code>configurePlatform()</code>. The drawing puts the
              first four on one row and <code>ErrorReporter</code> on the next, because the first
              four are what the core needs in order to work and this one is what it needs in order
              to be heard: the app runs without it, which is why its default reports nowhere. Beside
              them, <strong>types</strong>, one file of shared contracts.
            </li>
          </ol>
          <p>
            Below the contracts is a hard boundary. The platform SDKs (react-native, expo,
            expo-audio, react-native-mmkv) sit on the far side and nothing in the package imports
            them. <code>packages/app-core/test/boundary.test.ts</code> holds that line by refusing a
            list of names: react-native, expo, node built-ins, the NativeScript scopes, and the view
            layers the core used to be tied to. It matches the start of the import, so the storage
            SDK is caught by the <code>react-native</code> entry rather than needing one of its own.
            The same file also checks that <code>ports/index.ts</code> still declares all five
            ports, so a capability cannot reach the host without being named there.
          </p>
          <p>
            Two conventions: derived values are exported selectors taking state, never store
            methods. Imports use subpaths and no barrel, for example{' '}
            <code>@correctiv/app-core/stores/session</code>, because the root entry exposes only the
            ports.
          </p>
        </div>
      )}
    </figure>
  );
}
