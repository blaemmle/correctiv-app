import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';

/**
 * Which Vite the repository root hands out, which is not a question about this
 * package's own dependency.
 *
 * Two Vites live in this tree and always will until vitest 4: this package asks
 * for 8, vitest asks for a range that tops out at 7, and npm has to put one of
 * them at `node_modules/vite`. Whichever one lands there is the one every
 * *plugin* sees, because a plugin resolves `vite` from where it is installed —
 * the root — and not from the package being built.
 *
 * `uniwind/vite` is the plugin that cares. It reads `require('vite/package.json')`
 * to choose between a Rolldown code path and an esbuild one. With vitest's 7 at
 * the root it took the esbuild path under a Vite 8 build and said so, in a
 * deprecation warning about `optimizeDeps.esbuildOptions` that looked like
 * uniwind's problem rather than this repository's. Adding `vite` to the ROOT
 * package's devDependencies is what fixes it: npm then hoists 8 and nests
 * vitest's 7 under `node_modules/vitest/node_modules/vite`, where only vitest
 * looks.
 *
 * `overrides` is the wrong tool here and this is the reason: `vite` is a regular
 * `dependencies` entry of `vitest` and of `vite-node`, range
 * `^5.0.0 || ^6.0.0 || ^7.0.0-0`, not a peer. Forcing it to 8 would hand vitest a
 * version it does not declare support for.
 *
 * TROUBLESHOOTING.md, "Two Vites in one tree", has the symptom and the check.
 */
describe('the bundler the toolchain resolves', () => {
  function majorOf(from: string): number {
    const require = createRequire(join(from, 'package.json'));
    const { version } = require('vite/package.json') as { version: string };
    return Number(version.split('.')[0]);
  }

  it('hands Vite 8 or later to anything resolving from the repository root', () => {
    expect(majorOf(ROOT)).toBeGreaterThanOrEqual(8);
  });

  it('hands this package the same one', () => {
    // The two have to agree. A plugin reads the first and the build runs on the
    // second, and a disagreement between them is invisible in both.
    expect(majorOf(join(ROOT, 'apps/handbook'))).toBe(majorOf(ROOT));
  });
});

/**
 * The Node version, which is written in several places and was wrong in one.
 *
 * `package.json` refuses to install under an older one, every CI job pins the
 * version it runs, `.nvmrc` is what a developer's shell reads, and `README.md`
 * is the sentence a newcomer acts on. That last one said 20.19 for as long as
 * the others said 24, because nothing here reads prose and a repository that
 * runs fine on the maintainer's machine never finds out.
 *
 * `engines.node` is the fact and the rest are copies of it. This is the weaker
 * arrangement AGENTS.md describes — a real check would install Node and try —
 * but it catches the failure that actually happened, which is one copy moving
 * and the others staying put.
 */
describe('the Node version', () => {
  const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    engines: { node: string };
  };
  const required = Number(/(\d+)/.exec(root.engines.node)?.[1]);

  it('is a major version this test could read at all', () => {
    // Guards every assertion below: a range spelled `^24.1.0` or `>= 24` still
    // yields 24, but a rewrite to something with no leading number would make
    // the three checks below compare against NaN and pass nothing.
    expect(required).toBeGreaterThan(0);
  });

  it('is the one `.nvmrc` hands a developer', () => {
    const nvmrc = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim();
    expect(Number(nvmrc.replace(/^v/, '').split('.')[0])).toBe(required);
  });

  it('is the one every CI job runs', () => {
    const dir = join(ROOT, '.github/workflows');
    const pinned = readdirSync(dir).flatMap((file) => {
      const text = readFileSync(join(dir, file), 'utf8');
      return [...text.matchAll(/node-version:\s*'?(\d+)/g)].map((hit) => `${file}: ${hit[1]}`);
    });
    // Named rather than counted: a workflow that pins nothing is a different
    // defect from one that pins the wrong number, and only one of the two is
    // visible in a count.
    expect(pinned.filter((entry) => !entry.endsWith(`: ${required}`))).toEqual([]);
    expect(pinned.length).toBeGreaterThan(0);
  });

  it('is the one the README tells a newcomer to install', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    expect(/^Node (\d+)/m.exec(readme)?.[1]).toBe(String(required));
  });
});
