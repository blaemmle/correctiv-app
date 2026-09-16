import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FEEDS as CORE_FEEDS,
  RADIO_MOUNTS,
  YOUTUBE_FEEDS,
} from '@correctiv/app-core/data/feeds.config';

import { ROOT } from '../plugin/collect.ts';
import {
  COUNTS,
  FEEDS,
  feedFigures,
  gapAvailable,
  MEASURED,
  MEASURED_ON,
  NOT_CONTENT,
  PROBES,
  QUESTIONS,
  SOURCES,
  UNUSED,
} from '../content/sources.manifest.ts';

const DATA_DIR = 'packages/app-core/src/data';

/**
 * When a feed that has stopped counts as having started again.
 *
 * Half a year, and it is deliberately not the quarter `src/lib/measured.ts` uses
 * for the age of the whole run. That one asks "are these figures still worth
 * quoting"; this one asks "is the manifest's sentence about this feed still
 * true", and the two sentences it guards are about fifteen months and nine. A
 * feed the manifest calls stale that has published inside half a year is not a
 * measurement that drifted, it is an argument that has been overtaken.
 */
const STALE_AFTER_DAYS = 180;

function daysSince(iso: string): number {
  return Math.round((Date.now() - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000);
}

describe('the source manifest against the code', () => {
  /**
   * The assertion the manifest exists for.
   *
   * `SOURCES.md` is prose and cannot notice that somebody added a file. This can:
   * a new checked-in data set is sample data standing in for an API that does not
   * exist yet, it is indistinguishable from live content on screen, and the whole
   * point of the board is that it says so. A file added with no entry here would
   * otherwise appear on screen and nowhere in the inventory.
   */
  it('accounts for every file in the core’s data directory', () => {
    const onDisk = readdirSync(join(ROOT, DATA_DIR))
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .filter((name) => !NOT_CONTENT.includes(name));

    const declared = new Set(
      SOURCES.map((s) => s.module)
        .filter((m): m is string => Boolean(m))
        .filter((m) => m.startsWith(DATA_DIR))
        .map((m) => m.slice(DATA_DIR.length + 1)),
    );

    expect(onDisk.filter((name) => !declared.has(name))).toEqual([]);
  });

  it('names no module that has since moved', () => {
    // The other direction: an entry pointing at a file that no longer exists
    // would publish a dead link and a status nothing backs up.
    const missing = SOURCES.map((s) => s.module)
      .filter((m): m is string => Boolean(m))
      .filter((m) => !existsSync(join(ROOT, m)));
    expect(missing).toEqual([]);
  });

  it('gives every sample entry the thing it stands in for', () => {
    // A sample with no named replacement is indistinguishable from a decision to
    // ship invented content, and the difference is the whole of its status.
    const vague = SOURCES.filter((s) => s.status === 'sample' && !s.standsIn);
    expect(vague.map((s) => s.id)).toEqual([]);
  });

  it('gives every live entry an endpoint', () => {
    const vague = SOURCES.filter((s) => s.status === 'live' && !s.endpoint);
    expect(vague.map((s) => s.id)).toEqual([]);
  });
});

describe('the measuring day, which used to be one fact in two places', () => {
  const DOCUMENT = readFileSync(join(ROOT, 'SOURCES.md'), 'utf8');
  const MANIFEST = readFileSync(join(ROOT, 'apps/handbook/content/sources.manifest.ts'), 'utf8');

  /**
   * The pair this file used to hold together, and why there is no longer one.
   *
   * `SOURCES.md` stated the measuring day in its opening paragraph, the manifest
   * stated it again as `MEASURED_ON`, and a test compared the two strings —
   * because nothing else could notice them parting. That was the right test for
   * a fact typed twice, and the wrong shape to leave in place once the fact is
   * taken by a script: the day is now `MEASURED.measuredAt`, written by
   * `scripts/measure-sources.mjs`, read by the manifest and quoted by the
   * document. Comparing it to itself would be a test that cannot fail.
   *
   * So what is asserted is the retirement itself. Re-typing the day in either
   * place is how the pair comes back, and it comes back silently, because a
   * hand-typed date beside generated figures looks exactly like a correct one.
   */
  it('is typed in neither the manifest nor the document', () => {
    // Collected as sentences rather than asserted one at a time: `expect` takes
    // one argument under this repository's lint rules, so the explanation has to
    // be IN the value, which is also what makes the failure readable.
    const back: string[] = [];
    if (/MEASURED_ON\s*(?::[^=]*)?=\s*['"`]/.test(MANIFEST)) {
      back.push('the manifest types MEASURED_ON as a literal again, instead of reading the run');
    }
    // The old sentence, and any other claim in the document to have measured on
    // a particular day. The document quotes the run; it does not date it.
    const claim = /measured[^.]{0,80}on\s+\*\*(\d{4}-\d{2}-\d{2})\*\*/i.exec(DOCUMENT);
    if (claim !== null)
      back.push(`SOURCES.md states a measuring day of its own again: ${claim[1]}`);
    expect(back).toEqual([]);
  });

  /**
   * And the document has to point at what does carry it, or the retirement just
   * loses the reader. The two paths are checked on disk, so renaming either one
   * fails here rather than publishing a dead reference.
   */
  it('is pointed at from the document, by a path that exists', () => {
    const wrong = [
      'apps/handbook/scripts/measure-sources.mjs',
      'apps/handbook/content/sources.measured.ts',
    ].flatMap((path) => [
      ...(DOCUMENT.includes(path) ? [] : [`SOURCES.md no longer names ${path}`]),
      ...(existsSync(join(ROOT, path)) ? [] : [`${path} does not exist`]),
    ]);
    expect(wrong).toEqual([]);
  });

  it('is a day the manifest reads back as one', () => {
    expect(MEASURED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(MEASURED.measuredAt))).toBe(false);
  });
});

describe('the run against the configuration it is supposed to cover', () => {
  /**
   * The assertion that stops the run from quietly measuring less than it claims.
   *
   * The targets come out of `packages/app-core/src/data/feeds.config.ts` at run
   * time, so a feed added there is measured without anybody editing the script —
   * and is NOT in the committed run until somebody re-takes it. That gap is the
   * one this catches. Offline is not an excuse for missing rows either: the
   * script writes a row for a source that did not answer, so a re-take with the
   * network down still produces a complete file.
   */
  it('carries a row for every feed, mount and video feed the core configures', () => {
    const expected = [
      ...Object.keys(CORE_FEEDS).map((key) => `feed:${key}`),
      ...Object.values(RADIO_MOUNTS).map((mount) => `mount:${mount.name}`),
      ...Object.keys(YOUTUBE_FEEDS).map((key) => `youtube:${key}`),
      'newsletter:issues',
      'castopod:instance',
      'peertube:videos',
      'peertube:channels',
    ];
    // Guarded, because an empty expectation is satisfied by an empty run and the
    // whole point of this file is that a check must not be able to say nothing.
    expect(expected.length).toBeGreaterThanOrEqual(13);
    expect(expected.filter((id) => !PROBES.has(id))).toEqual([]);
  });

  it('gives a failed probe a reason, and a successful one none', () => {
    const silent = MEASURED.probes.filter((probe) => !probe.ok && !probe.reason);
    expect(silent.map((probe) => probe.id)).toEqual([]);
    const contradictory = MEASURED.probes.filter((probe) => probe.ok && probe.reason !== undefined);
    expect(contradictory.map((probe) => probe.id)).toEqual([]);
  });

  it('has unique probe ids', () => {
    expect(PROBES.size).toBe(MEASURED.probes.length);
  });

  /**
   * The check that replaces the date pair, and the one that can actually fail.
   *
   * `health` is the manifest's judgement and the sentence beside it is the
   * argument the whole document is built on: `lokal` is presented as a content
   * source and has not published since May 2025, which is open question 3. If
   * that feed starts moving again, the question has answered itself and the page
   * is asserting something false — and nothing else in the repository would
   * notice, because the figures beside the judgement would simply have changed.
   *
   * Only rows that answered are examined. A source being down must not redden a
   * pull request, and skipping it here is what keeps that true; the count below
   * is what stops "everything was down" from passing as "everything agrees".
   */
  it('has no health judgement the run contradicts', () => {
    const wrong: string[] = [];
    let checked = 0;

    for (const feed of FEEDS) {
      if (feed.health === 'stale') {
        const probe = PROBES.get(`feed:${feed.key}`);
        if (probe?.ok !== true || probe.newest === undefined) continue;
        checked += 1;
        const age = daysSince(probe.newest);
        if (age < STALE_AFTER_DAYS) {
          wrong.push(
            `${feed.label} is called stale and last published ${probe.newest}, ${age} days ago`,
          );
        }
      }
      if (feed.health === 'broken') {
        const probe = PROBES.get(`category:${feed.key}`);
        if (probe?.ok !== true) continue;
        checked += 1;
        if ((probe.available ?? 1) > 0) {
          wrong.push(`${feed.label} is called broken and its category now exists`);
        }
      }
    }

    expect(wrong).toEqual([]);

    /*
     * The vacuity guard, and it has to tell two silences apart.
     *
     * Checking nothing passes trivially, so a bare `checked > 0` looks like the
     * right guard and is the wrong one: it turns an outage at correctiv.org into
     * a red pull request, which is the single thing this whole change must not
     * do. What is asserted instead is WHY nothing was checked. Every judged feed
     * whose probe came back with a reason on it is a source that was down, and
     * that is allowed; a judged feed with no probe row at all is a join that has
     * quietly come apart, and that is the failure this catches.
     */
    const judged = FEEDS.filter((feed) => feed.health !== 'healthy');
    const down = judged.filter((feed) => {
      const probe = PROBES.get(
        feed.health === 'broken' ? `category:${feed.key}` : `feed:${feed.key}`,
      );
      return probe !== undefined && !probe.ok;
    });
    // Worked out first and asserted once, because a conditional `expect` is a
    // check that disappears under the condition nobody tested.
    const vacuous =
      checked > 0 || down.length === judged.length
        ? []
        : [
            `${checked} of ${judged.length} judgements were checked and only ${down.length} source was down; a probe row is missing`,
          ];
    expect(judged.length).toBeGreaterThan(0);
    expect(vacuous).toEqual([]);
  });

  it('answers with a figure for every feed row the board prints', () => {
    // `unknown` is a legitimate answer and is drawn as one; what must not happen
    // is a row whose key joins to nothing, which would print `unknown` forever
    // and look like an outage.
    const orphans = FEEDS.filter((feed) => !PROBES.has(`feed:${feed.key}`));
    expect(orphans.map((feed) => feed.label)).toEqual([]);
    for (const feed of FEEDS) {
      const figures = feedFigures(feed);
      expect(figures.posts.length).toBeGreaterThan(0);
      expect(figures.newest.length).toBeGreaterThan(0);
    }
  });
});

describe('the manifest on its own terms', () => {
  it('points every question reference at a question that exists', () => {
    const bad = SOURCES.flatMap((s) => (s.questions ?? []).map((q) => ({ id: s.id, q }))).filter(
      ({ q }) => q < 1 || q > QUESTIONS.length,
    );
    expect(bad).toEqual([]);
  });

  it('uses every question at least once', () => {
    // A question nothing raises is either answered or was never a question about
    // the app, and either way the board should not still be asking it.
    const raised = new Set(SOURCES.flatMap((s) => s.questions ?? []));
    const orphans = QUESTIONS.map((_, i) => i + 1).filter((n) => !raised.has(n));
    expect(orphans).toEqual([]);
  });

  it('has unique ids', () => {
    const ids = SOURCES.map((s) => s.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('counts what it holds, rather than what somebody typed', () => {
    // The landing page prints these. It printed two hand-typed numbers once and
    // disagreed with this page by four.
    expect(COUNTS.live + COUNTS.sample + COUNTS.noSource).toBe(SOURCES.length);
    expect(COUNTS.questions).toBe(QUESTIONS.length);
  });

  it('never reports a source as using more than exists', () => {
    // `available` is read off the run now, so this is the check that notices the
    // app reading a channel the instance has dropped, as well as a typo.
    const impossible = UNUSED.filter((u) => {
      const available = gapAvailable(u);
      return available !== undefined && u.used > available;
    });
    expect(impossible.map((u) => u.label)).toEqual([]);
  });

  it('gives every gap either a probe that exists or a number of its own', () => {
    const adrift = UNUSED.filter((u) =>
      u.probe === undefined ? u.available === undefined : !PROBES.has(u.probe),
    );
    expect(adrift.map((u) => u.label)).toEqual([]);
  });

  it('points every entry’s probe at a row in the run', () => {
    const adrift = SOURCES.filter((s) => s.probe !== undefined && !PROBES.has(s.probe));
    expect(adrift.map((s) => s.id)).toEqual([]);
  });

  it('explains every feed that is not healthy', () => {
    // Stale and broken are the rows a reader will stop on, and a status with no
    // sentence behind it is an accusation rather than a finding.
    const unexplained = FEEDS.filter((f) => f.health !== 'healthy' && !f.note);
    expect(unexplained.map((f) => f.label)).toEqual([]);
  });
});
