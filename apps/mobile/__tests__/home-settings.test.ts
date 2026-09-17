import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MODULE_SETTINGS } from '@correctiv/app-core/lib/home-settings';
import { floorFaults } from '@correctiv/prose-and-code';

import { render } from '../scripts/generate-home-settings.mjs';
import { HOME_MODULE_SETTINGS } from '@/lib/home/settings';

/**
 * What holds a declaration written in this app to the table the core validates against.
 *
 * ADR 0045 §9 puts the declaration beside the module that reads it and has
 * `scripts/generate-home-settings.mjs` carry it into
 * `packages/app-core/src/lib/home-settings.generated.ts`. That buys a module and its
 * settings being one thing to write and one thing to read, and it charges a commit: an
 * agent or a person who edits a declaration and does not run the generator gets a red
 * check here and a one-line fix. ADR 0031's mechanism 2, and the deal is only good while
 * this file exists.
 *
 * **Two failures, and they are not the same one.** The artefact can be stale against the
 * declarations — that is the drift check, and `npm run home-settings` fixes it. Or the
 * artefact can be current and the core still be reading something else, because the
 * re-export in `home-settings.ts` names the wrong file or somebody left a hand-written
 * table beside it. The first is about a file on disk, the second about what an import
 * actually resolves to, so they are asked separately and only the second one imports the
 * core.
 *
 * **What none of it says** is that a setting does anything. A spec no module reads still
 * validates, still shows up in the configurator and still draws a control — this checks
 * that both sides hold the same declarations, not that the declarations are wanted.
 * `__tests__/home-layout.test.tsx` is what refuses a module that cannot be drawn at all.
 */

/** The artefact, by the path the generator writes it to. */
const GENERATED = resolve(
  __dirname,
  '../../../packages/app-core/src/lib/home-settings.generated.ts',
);

describe('the settings a module declares beside itself', () => {
  const modules = Object.keys(HOME_MODULE_SETTINGS);
  const specs = Object.values(HOME_MODULE_SETTINGS).flat();

  it('declares something at all (guards against a silently empty table)', () => {
    // An empty table is not a table with nothing in it: the parser reads
    // `MODULE_SETTINGS[module] ?? []` and refuses every key it is given, so every
    // configured place in the shipped document would be dropped at once, and every
    // assertion below would pass over an empty array. The generator refuses to emit
    // nothing; this is the floor under that.
    //
    // A floor and not a count: what has to hold is that something was read, and a figure
    // measured against this repository goes stale the first time somebody declares a
    // fourth setting.
    expect(
      floorFaults({
        'modules with settings declared': { found: modules.length, atLeast: 2 },
        'settings declared': { found: specs.length, atLeast: 3 },
      }),
    ).toEqual([]);
  });

  it('keeps the generated table current (no drift against the declarations)', () => {
    // The hinge of the whole arrangement. When it fails the fix is
    // `npm run home-settings` and a commit — never a hand-edit of the artefact, which
    // says so on its first line.
    //
    // No subprocess and no write: `render` takes the table rather than importing it, so
    // what runs here is the same string `main()` writes.
    expect(readFileSync(GENERATED, 'utf8')).toBe(render(HOME_MODULE_SETTINGS));
  });

  it('is what the core actually validates against', () => {
    // The other half, and it is a different question from the one above: the artefact
    // can be current while `home-settings.ts` re-exports something else. This reads the
    // core through the same import the parser uses.
    expect(MODULE_SETTINGS).toEqual(HOME_MODULE_SETTINGS);
  });

  it('gives every setting a key its module can only mean one way', () => {
    // A key repeated inside one module is a spec the parser can never reach: it takes
    // the first match and the second is dead. Across modules it is fine and deliberate —
    // `count` belongs to two of them.
    const doubled = Object.entries(HOME_MODULE_SETTINGS).filter(
      ([, declared]) => new Set(declared.map((spec) => spec.key)).size !== declared.length,
    );
    expect(doubled.map(([module]) => module)).toEqual([]);
    expect(specs.filter((spec) => spec.key.trim() === '')).toEqual([]);
  });

  it('gives every count bounds it can hold and a default inside them', () => {
    // The bounds are what the module can actually draw, and the editor draws the control
    // from them — a slider whose ends are the wrong way round, or a default outside them,
    // is a control that opens on a value nobody can choose.
    const counts = specs.filter((spec) => spec.kind === 'count');
    const wrong = counts.filter(
      (spec) =>
        !Number.isInteger(spec.min) ||
        !Number.isInteger(spec.max) ||
        !Number.isInteger(spec.fallback) ||
        spec.min >= spec.max ||
        spec.fallback < spec.min ||
        spec.fallback > spec.max,
    );
    expect(wrong).toEqual([]);
    expect(counts.length).toBeGreaterThan(0);
  });

  it('refuses to write a kind it has never heard of', () => {
    // The union in the core would reject the artefact anyway, but the message would name
    // a generated file rather than the declaration that caused it. This is the generator
    // failing where the fix is.
    expect(() => render({ quiz: [{ key: 'answers', kind: 'choice' }] as never })).toThrow(
      /kind 'choice'/,
    );
  });

  it('names the command that fixes it, in the artefact itself', () => {
    // A generated file a person opens should say what to run instead of inviting an edit.
    const artefact = readFileSync(GENERATED, 'utf8');
    expect(artefact).toContain('npm run home-settings');
    expect(artefact).toContain('do not edit by hand');
  });
});
