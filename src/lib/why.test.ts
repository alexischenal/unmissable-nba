// src/lib/why.test.ts — run with: npm test
// With the example settings (EXAMPLE_SCORING): never the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeByClutch } from './scoring.ts';
import { whyLabels, whyOf } from './why.ts';
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

test('why: the story of the game never shows, so a tight finish alone gets no "?"', () => {
  // Every intense ingredient, without a big night: nothing to say
  const g = { ...flat, biggestLead: { home: 15, away: 26 }, late: { clutchSeconds: 600, marginAt2: 1, weightedSwings: 30 } };
  assert.equal(closeByClutch(g), true);
  assert.equal(whyOf(g), undefined);
});

test('why: a "scenario" key from an older night is ignored', () => {
  assert.deepEqual(whyLabels({ scenario: true }), []);
  assert.deepEqual(whyLabels({ scenario: true, big: 2 }), ['Big performance ×2']);
});

test('why: big and huge nights are counted, never named', () => {
  const why = whyOf({ ...flat, players: [player(60), player(50), player(48), player(40), player(30)] }); // example: 37 / 46 / 56
  assert.deepEqual(why, { crazy: 1, huge: 2, big: 1 });
  assert.deepEqual(whyLabels(why!), ['Crazy performance', 'Huge performance ×2', 'Big performance']);
});
