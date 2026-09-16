import { cn } from '../lib/cn';
import {
  ALT,
  ARC,
  ARC_DOC,
  ARC_INDEX,
  AXIS,
  BOLD,
  CAPTION,
  CHIP,
  DASHED,
  DRAWING,
  FIGURE,
  HALO,
  HATCH,
  MARKER,
  MARKER_LIGHT,
  MONO,
  MUTED,
  NODE_INTACT,
  NODE_MOOT,
  NODE_QUIET,
  NODE_STRUCK,
  RULE,
  SCROLL_BOX,
  STRIKE,
  T11,
  T12,
  T13,
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
export function DecisionsChainDrawing({ alt = false }: { alt?: boolean } = {}) {
  return (
    <svg
      viewBox="0 0 1100 985"
      className={cn(DRAWING, 'block h-[985px] w-[1100px] max-w-none')}
      aria-labelledby="d2-title"
      aria-describedby={alt ? 'd2-alt' : undefined}
    >
      {/*
        No count and no range in here. `adr/` grows, a number written into a title
        does not, and the lede beside the drawing already reads the count from
        `virtual:docs` rather than being told it.
      */}
      <title id="d2-title">
        The architecture decision records in order, with arcs from each later record to the earlier
        record whose claim it struck, and edges to the living documents it corrected
      </title>
      <defs>
        <marker
          id="d2-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" className={MARKER} />
        </marker>
        <marker
          id="d2-arrow-light"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" className={MARKER_LIGHT} />
        </marker>
        <pattern
          id="d2-hatch"
          patternUnits="userSpaceOnUse"
          width="5"
          height="5"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" className={HATCH} />
        </pattern>
      </defs>

      <text x="330" y="40" textAnchor="end" className={cn(T11, MUTED)}>
        a later record strikes a claim in an earlier one
      </text>
      <text x="360" y="40" className={cn(T11, MUTED)}>
        record
      </text>
      <text x="412" y="40" className={cn(T11, MUTED)}>
        title
      </text>
      <text x="700" y="40" className={cn(T11, MUTED)}>
        claims struck by
      </text>

      <line x1="340" y1="70" x2="340" y2="818" className={AXIS} />

      <g className={ARC_INDEX}>
        <path d="M330 274 C 210 274 210 104 330 104" markerEnd="url(#d2-arrow-light)" />
        <path d="M330 240 C 282 240 282 206 330 206" markerEnd="url(#d2-arrow-light)" />
        <path d="M330 274 C 264 274 264 206 330 206" markerEnd="url(#d2-arrow-light)" />
      </g>
      <text x="236" y="189" textAnchor="end" className={cn(T11, MUTED, HALO)}>
        index: moot
      </text>
      <text x="290" y="223" textAnchor="end" className={cn(T11, MUTED, HALO)}>
        index: amends
      </text>
      <text x="276" y="240" textAnchor="end" className={cn(T11, MUTED, HALO)}>
        index: carries out
      </text>

      <g className={ARC}>
        <path d="M330 342 C 210 342 210 172 330 172" markerEnd="url(#d2-arrow)" />
        <path d="M330 342 C 246 342 246 240 330 240" markerEnd="url(#d2-arrow)" />
        <path d="M330 410 C 192 410 192 206 330 206" markerEnd="url(#d2-arrow)" />
        <path d="M330 410 C 228 410 228 274 330 274" markerEnd="url(#d2-arrow)" />
        <path d="M330 546 C 138 546 138 240 330 240" markerEnd="url(#d2-arrow)" />
        <path d="M330 546 C 156 546 156 274 330 274" markerEnd="url(#d2-arrow)" />
        <path d="M330 546 C 246 546 246 444 330 444" markerEnd="url(#d2-arrow)" />
        <path d="M330 648 C 48 648 48 172 330 172" markerEnd="url(#d2-arrow)" />
        <path d="M330 648 C 264 648 264 580 330 580" markerEnd="url(#d2-arrow)" />
        <path d="M330 682 C 246 682 246 580 330 580" markerEnd="url(#d2-arrow)" />
        <path d="M330 682 C 282 682 282 648 330 648" markerEnd="url(#d2-arrow)" />
        <path d="M330 716 C 156 716 156 444 330 444" markerEnd="url(#d2-arrow)" />
        <path d="M330 716 C 228 716 228 580 330 580" markerEnd="url(#d2-arrow)" />
        <path d="M330 716 C 264 716 264 648 330 648" markerEnd="url(#d2-arrow)" />
        <path d="M330 716 C 282 716 282 682 330 682" markerEnd="url(#d2-arrow)" />
        <path d="M330 784 C 84 784 84 376 330 376" markerEnd="url(#d2-arrow)" />
      </g>
      <g className={cn(T11, HALO)}>
        <text x="236" y="257" textAnchor="end">
          2
        </text>
        <text x="263" y="291" textAnchor="end">
          2
        </text>
        <text x="249" y="342" textAnchor="end">
          2
        </text>
        <text x="182" y="393" textAnchor="end">
          the CORS item
        </text>
        <text x="263" y="495" textAnchor="end">
          1 row
        </text>
        <text x="276" y="614" textAnchor="end">
          2
        </text>
        <text x="290" y="665" textAnchor="end">
          2
        </text>
        <text x="290" y="699" textAnchor="end">
          5
        </text>
        <text x="141" y="580" textAnchor="end">
          2
        </text>
      </g>

      <g className={T13}>
        <circle cx="340" cy="70" r="3.5" className={NODE_QUIET} />
        <text x="360" y="70" className={cn(MONO, T12, MUTED)}>
          0001
        </text>

        <circle cx="340" cy="104" r="8" className={NODE_MOOT} />
        <text x="360" y="104" className={cn(MONO, BOLD, MUTED)}>
          0002
        </text>
        <text x="412" y="104" className={STRIKE}>
          Stay on Vite 7
        </text>
        <text x="700" y="104" className={cn(MONO, T12, MUTED)}>
          moot since 0007, per the index
        </text>

        <circle cx="340" cy="138" r="3.5" className={NODE_QUIET} />
        <text x="360" y="138" className={cn(MONO, T12, MUTED)}>
          0003
        </text>

        <circle cx="340" cy="172" r="8" className={NODE_STRUCK} />
        <text x="360" y="172" className={cn(MONO, BOLD)}>
          0004
        </text>
        <text x="412" y="172">
          React Native pivot
        </text>
        <text x="700" y="172" className={cn(MONO, T12, MUTED)}>
          0009, 0018
        </text>

        <circle cx="340" cy="206" r="8" className={NODE_STRUCK} />
        <text x="360" y="206" className={cn(MONO, BOLD)}>
          0005
        </text>
        <text x="412" y="206">
          Expo over NativeScript
        </text>
        <text x="700" y="206" className={cn(MONO, T12, MUTED)}>
          0011; index: 0006, 0007
        </text>

        <circle cx="340" cy="240" r="8" className={NODE_STRUCK} />
        <text x="360" y="240" className={cn(MONO, BOLD)}>
          0006
        </text>
        <text x="412" y="240">
          One core, two hosts
        </text>
        <text x="700" y="240" className={cn(MONO, T12, MUTED)}>
          0009, 0015
        </text>

        <circle cx="340" cy="274" r="8" className={NODE_STRUCK} />
        <text x="360" y="274" className={cn(MONO, BOLD)}>
          0007
        </text>
        <text x="412" y="274">
          Removing the NativeScript host
        </text>
        <text x="700" y="274" className={cn(MONO, T12, MUTED)}>
          0011, 0015
        </text>

        <circle cx="340" cy="308" r="3.5" className={NODE_QUIET} />
        <text x="360" y="308" className={cn(MONO, T12, MUTED)}>
          0008
        </text>

        <circle cx="340" cy="342" r="8" className={NODE_INTACT} />
        <text x="360" y="342" className={cn(MONO, BOLD)}>
          0009
        </text>
        <text x="412" y="342" className={MUTED}>
          Redux Toolkit for the core's state
        </text>

        <circle cx="340" cy="376" r="8" className={NODE_STRUCK} />
        <text x="360" y="376" className={cn(MONO, BOLD)}>
          0010
        </text>
        <text x="412" y="376">
          Design tokens as a shared package
        </text>
        <text x="700" y="376" className={cn(MONO, T12, MUTED)}>
          0022
        </text>

        <circle cx="340" cy="410" r="8" className={NODE_INTACT} />
        <text x="360" y="410" className={cn(MONO, BOLD)}>
          0011
        </text>
        <text x="412" y="410">
          Naming the app for release
        </text>

        <circle cx="340" cy="444" r="8" className={NODE_STRUCK} />
        <text x="360" y="444" className={cn(MONO, BOLD)}>
          0012
        </text>
        <text x="412" y="444">
          A list virtualizer
        </text>
        <text x="700" y="444" className={cn(MONO, T12, MUTED)}>
          0015, 0020
        </text>

        <circle cx="340" cy="478" r="3.5" className={NODE_QUIET} />
        <text x="360" y="478" className={cn(MONO, T12, MUTED)}>
          0013
        </text>

        <circle cx="340" cy="512" r="8" className={NODE_INTACT} />
        <text x="360" y="512" className={cn(MONO, BOLD)}>
          0014
        </text>
        <text x="412" y="512">
          The preview shell as a package
        </text>

        <circle cx="340" cy="546" r="8" className={NODE_INTACT} />
        <text x="360" y="546" className={cn(MONO, BOLD)}>
          0015
        </text>
        <text x="412" y="546">
          Reading correctiv.org through its REST API
        </text>

        <circle cx="340" cy="580" r="8" className={NODE_STRUCK} />
        <text x="360" y="580" className={cn(MONO, BOLD)}>
          0016
        </text>
        <text x="412" y="580">
          A door at the root
        </text>
        <text x="700" y="580" className={cn(MONO, T12, MUTED)}>
          0018, 0019, 0020
        </text>

        <circle cx="340" cy="614" r="3.5" className={NODE_QUIET} />
        <text x="360" y="614" className={cn(MONO, T12, MUTED)}>
          0017
        </text>

        <circle cx="340" cy="648" r="8" className={NODE_STRUCK} />
        <text x="360" y="648" className={cn(MONO, BOLD)}>
          0018
        </text>
        <text x="412" y="648">
          Removing the guest
        </text>
        <text x="700" y="648" className={cn(MONO, T12, MUTED)}>
          0019, 0020
        </text>

        <circle cx="340" cy="682" r="8" className={NODE_STRUCK} />
        <text x="360" y="682" className={cn(MONO, BOLD)}>
          0019
        </text>
        <text x="412" y="682">
          Identity lives in the session
        </text>
        <text x="700" y="682" className={cn(MONO, T12, MUTED)}>
          0020
        </text>

        <circle cx="340" cy="716" r="8" className={NODE_INTACT} />
        <text x="360" y="716" className={cn(MONO, BOLD)}>
          0020
        </text>
        <text x="412" y="716">
          No contribution in the app
        </text>

        <circle cx="340" cy="750" r="3.5" className={NODE_QUIET} />
        <text x="360" y="750" className={cn(MONO, T12, MUTED)}>
          0021
        </text>

        <circle cx="340" cy="784" r="8" className={NODE_INTACT} />
        <text x="360" y="784" className={cn(MONO, BOLD)}>
          0022
        </text>
        <text x="412" y="784">
          Three tiers of colour
        </text>

        <circle cx="340" cy="818" r="8" className={NODE_INTACT} />
        <text x="360" y="818" className={cn(MONO, BOLD)}>
          0023
        </text>
        <text x="412" y="818">
          The host constructs the store
        </text>
      </g>

      <rect x="888" y="470" width="204" height="352" rx="10" className={DASHED} />
      <text x="990" y="470" textAnchor="middle" className={cn(T11, MUTED, HALO)}>
        living documents
      </text>
      <text x="990" y="492" textAnchor="middle" className={cn(T11, MUTED)}>
        rewritten in place, unlike a record
      </text>
      <rect x="900" y="514" width="180" height="30" rx="6" className={CHIP} />
      <text x="990" y="529" textAnchor="middle" className={cn(MONO, T12)}>
        README.md
      </text>
      <rect x="900" y="604" width="180" height="30" rx="6" className={CHIP} />
      <text x="990" y="619" textAnchor="middle" className={cn(MONO, T12)}>
        ARCHITECTURE.md
      </text>
      <text x="990" y="650" textAnchor="middle" className={cn(T11, MUTED)}>
        0015 also: apps/, .github/, tests
      </text>
      <rect x="900" y="776" width="180" height="30" rx="6" className={CHIP} />
      <text x="990" y="791" textAnchor="middle" className={T12}>
        code comments
      </text>

      <g className={ARC_DOC}>
        <path d="M700 512 C 800 512 800 529 896 529" markerEnd="url(#d2-arrow)" />
        <path d="M700 546 C 800 546 800 619 896 619" markerEnd="url(#d2-arrow)" />
        <path d="M700 784 C 800 784 800 619 896 619" markerEnd="url(#d2-arrow)" />
        <path d="M700 818 C 800 818 800 619 896 619" markerEnd="url(#d2-arrow)" />
        <path d="M700 818 C 800 818 800 791 896 791" markerEnd="url(#d2-arrow)" />
      </g>
      <g className={cn(T11, HALO)}>
        <text x="800" y="520" textAnchor="middle">
          1
        </text>
        <text x="800" y="582" textAnchor="middle">
          1 claim, in 18 places
        </text>
        <text x="800" y="701" textAnchor="middle">
          2
        </text>
        <text x="800" y="722" textAnchor="middle">
          1
        </text>
        <text x="800" y="806" textAnchor="middle">
          4
        </text>
      </g>

      <line x1="40" y1="848" x2="1092" y2="848" className={RULE} />
      <g className={T12}>
        <circle cx="60" cy="872" r="8" className={NODE_INTACT} />
        <text x="76" y="872">
          accepted, intact
        </text>
        <circle cx="260" cy="872" r="8" className={NODE_STRUCK} />
        <text x="276" y="872">
          accepted, some claims struck through in place
        </text>
        <circle cx="600" cy="872" r="8" className={NODE_MOOT} />
        <text x="616" y="872">
          <tspan className={STRIKE}>moot</tspan>, superseded in substance
        </text>
        <line x1="40" y1="908" x2="96" y2="908" className={ARC} markerEnd="url(#d2-arrow)" />
        <text x="108" y="908">
          the later record names the claim it strikes, a number says how many
        </text>
        <line
          x1="40"
          y1="936"
          x2="96"
          y2="936"
          className={ARC_INDEX}
          markerEnd="url(#d2-arrow-light)"
        />
        <text x="108" y="936">
          recorded only in the index, before 0009 no record named what it retired
        </text>
        <line x1="40" y1="964" x2="96" y2="964" className={ARC_DOC} markerEnd="url(#d2-arrow)" />
        <text x="108" y="964">
          a claim struck in a living document, which is rewritten rather than annotated
        </text>
      </g>
    </svg>
  );
}

/**
 * The second drawing: which decisions still stand, and which of their claims do
 * not.
 *
 * The list under it is not a caption, it is the page for anyone who cannot use
 * the drawing, and `aria-describedby` points at it, which is why the ids here
 * have to stay as they are.
 */
export function DecisionsChain({ alt = true }: { alt?: boolean }) {
  return (
    <figure className={FIGURE}>
      <section className={SCROLL_BOX} aria-label="Diagram 2, scrollable" tabIndex={0}>
        <DecisionsChainDrawing alt={alt} />
      </section>
      <figcaption className={CAPTION}>
        <strong>A record is amended, never rewritten, so its history is a set of arcs.</strong>{' '}
        Solid arcs come from each later record's own section naming what it retires. The three
        dotted ones exist only in the index, because that section starts at 0009. Dashed edges to
        the right are the corrections that landed in <code>ARCHITECTURE.md</code>,{' '}
        <code>README.md</code> and code comments, which do get rewritten. 0020 is the busiest
        record, striking four others and five claims in 0019 alone. 0016 is the most amended, struck
        three times and still accepted.
      </figcaption>
      {alt && (
        <div className={ALT} id="d2-alt">
          <h3>The same diagram as a list</h3>
          <p>
            Three states: <em>intact</em>, <em>accepted with some claims struck</em>, and{' '}
            <em>moot</em>. Each entry names who struck it and, where the record states one, how many
            claims.
          </p>
          <ul>
            <li>0001, 0003, 0008, 0013, 0017, 0021: intact, no relations recorded.</li>
            <li>
              0002 <s>Stay on Vite 7</s>: moot since 0007, recorded only in the index.
            </li>
            <li>
              0004 React Native pivot: accepted, struck by 0009 (two claims: the zustand store
              count, and that the port was synchronous) and by 0018.
            </li>
            <li>
              0005 Expo over NativeScript: accepted, struck by 0011. The index also records that
              0006 amends it and 0007 carries it out.
            </li>
            <li>
              0006 One core, two hosts: accepted, struck by 0009 (two claims: the ports table, and
              the synchronous-KeyValueStore premise) and by 0015 (the CORS item).
            </li>
            <li>
              0007 Removing the NativeScript host: accepted, struck by 0011 (two claims) and by
              0015. The index records that it renders 0002 moot and carries out 0005.
            </li>
            <li>
              0009 Redux Toolkit for the core's state: intact. Strikes 0004 and 0006. The first
              record with a section naming what it retires.
            </li>
            <li>0010 Design tokens as a shared package: accepted, struck by 0022 (two claims).</li>
            <li>0011 Naming the app for release: intact. Strikes 0005 and 0007.</li>
            <li>
              0012 A list virtualizer: accepted, struck by 0015 (one table row's reason, the
              conclusion untouched) and by 0020.
            </li>
            {/*
              0014 is drawn above as intact and is described here as struck, and the
              two disagree on purpose. 0024 struck two of its claims, but the axis
              ends at 0023 and there is no row below it that would not land on the
              legend, so the arc this list names cannot be drawn without moving the
              legend. The list is the half that can carry the truth today.
            */}
            {/*
              No count on this one. The strikes 0024 left in 0014 are still being
              written, so a number here would be wrong by the time it is read; what
              0024's own "what this retires" section names is stable, and that is
              what this says instead.
            */}
            <li>
              0014 The preview shell as a package: accepted, struck by 0024 in several places. The
              workspace package <code>tools/preview</code> is gone, building into{' '}
              <code>apps/mobile/public/</code> is no longer the only way to be on the app&apos;s
              origin, and the costs that move removed are struck where they stand. Its same-origin
              argument itself is untouched. Retired one claim in <code>README.md</code>.
            </li>
            <li>
              0015 Reading correctiv.org through its REST API: intact. Strikes 0006, 0007 and 0012,
              and retired one claim in eighteen places across <code>ARCHITECTURE.md</code>,{' '}
              <code>apps/</code>, <code>.github/</code> and the tests.
            </li>
            <li>0016 A door at the root: accepted, struck by 0018 (two claims), 0019 and 0020.</li>
            <li>
              0018 Removing the guest: accepted, struck by 0019 (two claims) and 0020. Strikes 0004
              and 0016.
            </li>
            <li>
              0019 Identity lives in the session: accepted, struck by 0020 (five claims). Strikes
              0016 and 0018.
            </li>
            <li>0020 No contribution in the app: intact. Strikes 0012, 0016, 0018 and 0019.</li>
            <li>
              0022 Three tiers of colour: intact. Strikes 0010 and retired two claims in{' '}
              <code>ARCHITECTURE.md</code>.
            </li>
            <li>
              0023 The host constructs the store: intact. Strikes no record; corrected one claim in{' '}
              <code>ARCHITECTURE.md</code> and four code comments.
            </li>
          </ul>
          <p>
            Records never rewritten; the living documents <code>ARCHITECTURE.md</code>,{' '}
            <code>README.md</code> and code comments are rewritten in place and sit downstream of
            the decisions.
          </p>
        </div>
      )}
    </figure>
  );
}
