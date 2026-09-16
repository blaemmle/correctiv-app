import { cn } from '../lib/cn';
import { href } from '../router';
import {
  ALT,
  ARC_INDEX,
  BOLD,
  BOX_CORE,
  CAPTION,
  CHIP_PORT,
  DRAWING,
  FIGURE,
  HALO,
  MARKER,
  MONO,
  MUTED,
  NODE_INTACT,
  NODE_MOOT,
  NODE_STRUCK,
  PROSE_CODE,
  RULE,
  SCROLL_BOX,
  WIRE,
} from './shared';

/**
 * The drawing alone, without the box that scrolls it or the list beside it.
 *
 * It names itself through the `<title>` inside it rather than an id outside, so
 * unlike the other three it needs nothing from the page around it.
 */
export function ServicesDrawing() {
  return (
    <svg viewBox="0 0 980 580" className={cn(DRAWING, 'h-auto w-[980px]')}>
      <title>
        The app, the identity system it asks about membership, and the content sources it reads
      </title>

      <defs>
        <marker
          id="d4-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L8 4 L0 8 z" className={MARKER} />
        </marker>
      </defs>

      {/* The app, drawn once, because both halves ask the same questions. */}
      <rect x="24" y="196" width="216" height="128" rx="8" className={BOX_CORE} />
      <text x="44" y="226" className={cn(MONO, BOLD)} fontSize="14">
        the app
      </text>
      <text x="44" y="252" className={MONO} fontSize="12">
        packages/app-core
      </text>
      <text x="44" y="272" className={MONO} fontSize="12">
        apps/mobile
      </text>
      <text x="44" y="300" className={MUTED} fontSize="12">
        every request below is the core&apos;s
      </text>

      {/* The door. Above the rest and on its own wire, because it is the
          only one whose answer decides whether the app renders at all. */}
      <rect x="612" y="28" width="344" height="112" rx="8" className={CHIP_PORT} />
      <text x="632" y="58" className={BOLD} fontSize="14">
        beabee
      </text>
      <text x="632" y="80" fontSize="12">
        identity and membership
      </text>
      <text x="632" y="102" className={MUTED} fontSize="12">
        one login for website and app: the tier, whether
      </text>
      <text x="632" y="120" className={MUTED} fontSize="12">
        the app is included, why, and for how long
      </text>

      <path d="M240 232 C 420 232, 440 84, 612 84" className={WIRE} markerEnd="url(#d4-arrow)" />
      <text x="404" y="140" className={cn(MUTED, HALO)} fontSize="12">
        who is this, and may they be here
      </text>
      <rect x="612" y="150" width="150" height="22" rx="11" className={NODE_STRUCK} />
      <text x="628" y="162" fontSize="11">
        simulated today
      </text>
      <text x="774" y="162" className={MUTED} fontSize="11">
        services/auth.service.ts
      </text>

      {/* Content, in one band, because the app treats it all the same way. */}
      <line x1="300" y1="200" x2="956" y2="200" className={RULE} />
      <text x="300" y="188" className={cn(MUTED, BOLD)} fontSize="11">
        CONTENT
      </text>

      {[
        {
          y: 214,
          name: 'correctiv.org',
          detail: 'WordPress REST: posts, newsletters, search',
          state: 'live',
        },
        {
          y: 254,
          name: 'salon5.correctiv.net',
          detail: 'Castopod, podcast RSS per show',
          state: 'live',
        },
        {
          y: 294,
          name: 'icecast.correctiv.net',
          detail: 'live radio, three mounts',
          state: 'live',
        },
        {
          y: 334,
          name: 'tube.funfacts.de',
          detail: 'PeerTube, nine channels',
          state: 'live',
        },
        { y: 374, name: 'YouTube', detail: 'Atom feeds', state: 'live' },
        { y: 414, name: 'Faktenforum', detail: 'GraphQL, the claims', state: 'sample' },
        {
          y: 454,
          name: 'abriss-atlas.de',
          detail: 'no public API exists',
          state: 'sample',
        },
        { y: 494, name: 'beabee CrowdNewsroom', detail: 'the callouts', state: 'sample' },
      ].map((row) => (
        <g key={row.name}>
          <path
            d={`M240 260 C 300 260, 300 ${row.y}, 360 ${row.y}`}
            className={row.state === 'live' ? WIRE : ARC_INDEX}
            markerEnd="url(#d4-arrow)"
          />
          <circle
            cx="372"
            cy={row.y}
            r="4"
            className={row.state === 'live' ? NODE_INTACT : NODE_MOOT}
          />
          <text x="390" y={row.y} className={cn(MONO, BOLD)} fontSize="12">
            {row.name}
          </text>
          <text x="612" y={row.y} className={MUTED} fontSize="12">
            {row.detail}
          </text>
        </g>
      ))}

      {/* The legend, because two line weights and two node fills are two
          distinctions and neither is obvious from the drawing alone. */}
      <line x1="360" y1="524" x2="956" y2="524" className={RULE} />
      <circle cx="372" cy="548" r="4" className={NODE_INTACT} />
      <text x="390" y="548" fontSize="11">
        live today, over the network
      </text>
      <circle cx="612" cy="548" r="4" className={NODE_MOOT} />
      <text x="630" y="548" fontSize="11">
        a checked-in file, shaped like the API that will replace it
      </text>
    </svg>
  );
}

/**
 * The third drawing: the app, the identity system it asks about membership, and
 * the content sources it reads.
 */
export function Services({ alt = true }: { alt?: boolean }) {
  return (
    <figure className={FIGURE}>
      {/*
        Third, because `diagrams/index.ts` orders it third and `DiagramView` counts
        the breadcrumb off that same array. The number a screen reader hears and the
        number the page shows have to be the one number.
      */}
      <section className={SCROLL_BOX} aria-label="Diagram 3, scrollable" tabIndex={0}>
        <ServicesDrawing />
      </section>
      <figcaption className={CAPTION}>
        <strong>beabee is the door; the rest is what is behind it.</strong> Its answer decides
        whether the app renders its routes at all, which no content source does, so it is drawn on
        its own wire. That answer is simulated today, in{' '}
        <code className={PROSE_CODE}>services/auth.service.ts</code>, and the shape of the answer is
        the contract. Five content sources are live; three are files typed in the shape of the API
        meant to replace them. Which is which, and the figures behind each, is the{' '}
        <a href={href('/sources')} className="underline decoration-accent underline-offset-2">
          sources board
        </a>
        .
      </figcaption>
      {alt && (
        <div className={ALT}>
          <h3>The same diagram as a list</h3>
          <p className="mt-xs">
            <strong>beabee, identity and membership.</strong> One login for the website and the app.
            It answers with the tier, whether the app is included, why, and for how long. The app
            asks it once at the door and renders its routes only on a yes. Simulated today in{' '}
            <code className={PROSE_CODE}>packages/app-core/src/services/auth.service.ts</code>;
            nothing reaches a network, and the screen that calls it says so.
          </p>
          <p className="mt-xs font-semibold">Content the app reads live</p>
          <ul className="mt-3xs list-disc pl-m">
            <li>
              <code className={PROSE_CODE}>correctiv.org</code>, WordPress REST: articles by
              category, the newsletter archive, and search.
            </li>
            <li>
              <code className={PROSE_CODE}>salon5.correctiv.net</code>, CORRECTIV&apos;s own
              Castopod, standard podcast RSS per show.
            </li>
            <li>
              <code className={PROSE_CODE}>icecast.correctiv.net</code>, live radio, three mounts.
            </li>
            <li>
              <code className={PROSE_CODE}>tube.funfacts.de</code>, CORRECTIV&apos;s own PeerTube,
              nine channels.
            </li>
            <li>YouTube, Atom feeds.</li>
          </ul>
          <p className="mt-xs font-semibold">Content that is a file standing in for a service</p>
          <ul className="mt-3xs list-disc pl-m">
            <li>Faktenforum, a GraphQL backend, for the claims.</li>
            <li>abriss-atlas.de, which has no public API.</li>
            <li>beabee CrowdNewsroom, for the callouts.</li>
          </ul>
          <p className="mt-xs">
            The counts, the dates each figure was measured on, and the wanted features with no
            source at all are on the sources board.
          </p>
        </div>
      )}
    </figure>
  );
}
