import { cn } from '../../lib/cn';
import { COMBINATIONS, type Status } from '../api';

/**
 * Which appearance combination is actually on screen, plus size and zoom.
 *
 * The first part is the point. `TROUBLESHOOTING.md` records a shipped bug that a
 * browser walk missed precisely because the walk set the app to `dark` and
 * emulated `prefers-color-scheme: light`, "exercising both paths that work and
 * neither that breaks". You cannot avoid a combination you cannot see you are
 * in, so the shell states it rather than leaving it to be inferred.
 *
 * It goes in the status line because that is where a fact about the current view
 * belongs, and because the line is there on every view anyway.
 */
export function Readout({
  status,
  size,
  scale,
}: {
  status: Status;
  size: { w: number; h: number };
  scale: number;
}) {
  const combo = COMBINATIONS.find((c) => c.n === status.combination);
  return (
    <>
      <span className="flex shrink-0 items-center gap-2xs">
        {/*
          A swatch of what the APP is painting, which must not follow this page's
          own scheme. `bg-white` and `bg-neutral-700` are primitives for exactly
          that reason: they are the two grounds a device scheme means, and a role
          would move with the wrong thing.
        */}
        <span
          aria-hidden="true"
          className={cn(
            'size-[0.625rem] rounded-full border border-stroke-strong',
            status.active === 'dark' ? 'bg-neutral-700' : 'bg-white',
          )}
        />
        App is <b className="text-on-canvas">{status.active}</b>
      </span>

      <span className="hidden shrink-0 md:inline">
        setting <b className="text-on-canvas">{status.appTheme ?? 'unknown'}</b>, device reports{' '}
        <b className="text-on-canvas">{status.scheme ?? 'unknown'}</b>
      </span>

      <span className="hidden shrink-0 lg:inline">
        combination{' '}
        <b className="font-mono tabular-nums text-on-canvas">
          {combo ? `${combo.n} of 4` : 'unknown'}
        </b>
        {combo?.isDefault && ', the default'}
      </span>

      <span className="shrink-0 tabular-nums">
        {size.w} × {size.h} at {Math.round(scale * 100)}%
      </span>

      {/*
        Said in words, not by greying something out. Half the panels in the tools
        sidebar cannot work in the static export, and a reader who never opens
        them still deserves to know which build they are looking at.
      */}
      {!status.handle && (
        <span className="hidden shrink-0 text-on-canvas-accent xl:inline">
          Published build, no dev handle
        </span>
      )}
    </>
  );
}
