// src/lib/why.test.ts — run with: npm test
// With the example settings (EXAMPLE_SCORING): never the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeByClutch } from './scoring.ts';
import { hasScenario, whyLabels, whyOf } from './why.ts';
import { detAtPhi } from '../../fixtures/2026-04-04-det-phi.ts';
import type { Game, PlayerLine } from '../types/game.ts';

// A player line with a given efficiency (points only, no misses)
const player = (eff: number): PlayerLine =>
  ({ team: 'home', pts: eff, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, tov: 0 });
// A flat blowout: no clutch, no swings, nobody above the example thresholds
const flat: Game = { ...detAtPhi, players: [player(20)], late: { clutchSeconds: 0, marginAt2: 20, weightedSwings: 0 } };

test('why: a flat blowout has nothing to say, so no "?"', () => {
  assert.equal(whyOf(flat), undefined);
});

test('why: a tight finish ALWAYS gets Scenario, whatever the rest of the game', () => {
  // Every combination of a tight finish: some clutch time, or a small margin at 2:00
  for (const late of [
    { clutchSeconds: 600, marginAt2: 20, weightedSwings: 0 },
    { clutchSeconds: 0, marginAt2: 1, weightedSwings: 0 },
  ]) {
    const g = { ...flat, late };
    assert.equal(closeByClutch(g), true);
    assert.equal(hasScenario(g), true);
    assert.equal(whyOf(g)?.scenario, true);
  }
});

test('why: a big comeback gets Scenario, so do lead changes all game long', () => {
  assert.equal(hasScenario({ ...flat, biggestLead: { home: 15, away: 26 } }), true); // PHI (home) lost
  assert.equal(hasScenario({ ...flat, late: { ...flat.late!, weightedSwings: 30 } }), true);
});

test('why: big and huge nights are counted, never named', () => {
  const why = whyOf({ ...flat, players: [player(50), player(48), player(40), player(30)] }); // example: 37 / 46
  assert.deepEqual(why, { huge: 2, big: 1 });
  assert.deepEqual(whyLabels(why!), ['Huge night ×2', 'Big night']);
  assert.deepEqual(whyLabels({ scenario: true, big: 2 }), ['Scenario', 'Big night ×2']);
});
