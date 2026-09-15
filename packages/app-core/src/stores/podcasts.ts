import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { PODCAST_CHANNELS } from '../data/feeds.config';
import { podcastSeries as sampleSeries, type PodcastSeries } from '../data/podcasts';
import { platform } from '../ports';
import { getCached, getStale, setCached } from '../services/cache.service';
import { fetchPodcastSeries } from '../services/podcast.service';
import type { AppThunk } from './store';

const CACHE_NS = 'podcasts';
const TTL_MS = 60 * 60 * 1000;

/**
 * How much of the list is real.
 *
 * - `ready`   — every curated show came back live.
 * - `partial` — some shows failed; the list mixes live, cached and bundled entries.
 * - `offline` — nothing was reachable, this is the typed sample seed.
 *
 * An earlier store had one flag for the last two, and that is exactly the
 * distinction a demo needs to make: "a show is missing" is not the same as "you
 * are looking at sample data".
 */
export type PodcastsStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'offline';

export interface PodcastsState {
  series: PodcastSeries[];
  status: PodcastsStatus;
}

const initialState: PodcastsState = { series: [], status: 'idle' };

/** Pure selector — see the note in stores/interests.ts for why not part of the slice. */
export function findSeries(state: PodcastsState, id: string): PodcastSeries | null {
  return state.series.find((s) => s.id === id) ?? null;
}

const slice = createSlice({
  name: 'podcasts',
  initialState,
  reducers: {
    statusChanged(state, action: PayloadAction<PodcastsStatus>) {
      state.status = action.payload;
    },
    loaded(state, action: PayloadAction<{ series: PodcastSeries[]; status: PodcastsStatus }>) {
      state.series = action.payload.series;
      state.status = action.payload.status;
    },
  },
});

export const podcastsReducer = slice.reducer;
export const { statusChanged, loaded } = slice.actions;

/**
 * The Salon5 podcast library (Castopod).
 *
 * Cascade, deliberately explicit: fresh cache → the seven curated shows live,
 * each falling back to the host's bundled snapshot → stale cache → typed sample
 * seed. The list is never empty, online or off — the same promise the feed cache
 * makes.
 *
 * The per-show bundled snapshot reaches the core through the `ContentBundle`
 * port, so every host can offer it and none needs a store of its own to do it.
 */
export const fetchAll =
  (options: { force?: boolean } = {}): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const cached = options.force ? null : await getCached<PodcastSeries[]>(CACHE_NS, 'all', TTL_MS);
    if (cached?.length) {
      dispatch(loaded({ series: cached, status: 'ready' }));
      return;
    }
    if (getState().podcasts.series.length === 0) dispatch(statusChanged('loading'));

    let liveCount = 0;
    const results = await Promise.all(
      PODCAST_CHANNELS.map(async (handle) => {
        try {
          const series = await fetchPodcastSeries(handle);
          liveCount += 1;
          return series;
        } catch {
          return platform().content.podcastSeries(handle);
        }
      }),
    );
    const series = results.filter((s): s is PodcastSeries => !!s && s.episodes.length > 0);

    if (series.length > 0) {
      // The status describes what is on screen, not how many requests succeeded:
      // a show whose feed parsed but carried no episodes is just as missing as one
      // that timed out, and an empty tile is worse than no tile.
      dispatch(
        loaded({
          series,
          status: series.length === PODCAST_CHANNELS.length ? 'ready' : 'partial',
        }),
      );
      // Only cache when at least one show is live: caching a bundle-only list
      // would freeze the offline state in for a whole hour after the network came back.
      if (liveCount > 0) await setCached(CACHE_NS, 'all', series);
      return;
    }

    // Nothing reachable. Stale beats nothing, and the seed beats an empty screen.
    const stale = await getStale<PodcastSeries[]>(CACHE_NS, 'all');
    dispatch(
      loaded({
        series: stale?.length ? stale : sampleSeries,
        status: stale?.length ? 'partial' : 'offline',
      }),
    );
  };
