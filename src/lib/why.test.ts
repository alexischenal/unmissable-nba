// src/lib/why.test.ts — run with: npm test
// With the example settings (EXAMPLE_SCORING): never the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeByClutch, displayScore } from './scoring.ts';
import { whyChips, whyLabels, whyOf } from './why.ts';
import { usePeaks } from '../config/peaks.ts';
import { detAtPhi } from '../../fixtures/2026-04-04-det-phi.ts';
import type { Game, PlayerLine } from '../types/game.ts';

// A player line with a given efficiency (points only, no misses)
const player = (eff: number): PlayerLine =>
  ({ team: 'home', pts: eff, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, tov: 0 });
// A flat blowout: no clutch, no swings, nobody above the example thresholds
const flat: Game = { ...detAtPhi, players: [player(20)], late: { clutchSeconds: 0, marginAt2: 20, weightedSwings: 0 } };
// The same game with a tight finish: competitive, so a historic night can light the spicy rock
const close: Game = { ...flat, late: { clutchSeconds: 600, marginAt2: 1, weightedSwings: 0 } };

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

test('why: a big scoring night is a big night, even with a low efficiency', () => {
  // 44 points on 16/40 with 6 turnovers: efficiency well under the example big night (37), 44 ≥ 41 points
  const scorer: PlayerLine = { ...player(0), pts: 44, fgm: 16, fga: 40, ftm: 8, fta: 8, tov: 6 };
  assert.deepEqual(whyOf({ ...flat, players: [scorer] }), { big: 1 });
  // Never above big on points alone, never counted twice
  assert.deepEqual(whyOf({ ...flat, players: [{ ...player(57), pts: 57 }] }), { crazy: 1 });
  assert.equal(whyOf({ ...flat, players: [{ ...scorer, pts: 40 }] }), undefined);
});

test('why: big and huge nights are counted, never named', () => {
  const why = whyOf({ ...flat, players: [player(57), player(47), player(46), player(40), player(30)] }); // example: 37 / 46 / 56, duel 48
  assert.deepEqual(why, { crazy: 1, huge: 2, big: 1 });
  assert.deepEqual(whyLabels(why!), ['Crazy performance', 'Huge performance ×2', 'Big performance']);
});

test('why: a historic night is nuclear, never announced, and counted once', () => {
  // Example settings: 58 points, or 68 of efficiency, or a quadruple-double
  const sixty: PlayerLine = { ...player(0), pts: 61, fgm: 20, fga: 40, ftm: 15, fta: 18, tov: 5 };
  const quadruple: PlayerLine = { ...player(0), pts: 18, reb: 12, ast: 11, blk: 10 };
  assert.deepEqual(whyOf({ ...close, players: [sixty] }), { nuclear: 1 });
  assert.deepEqual(whyOf({ ...close, players: [quadruple] }), { nuclear: 1 });
  assert.deepEqual(whyOf({ ...close, players: [player(70), player(40)] }), { nuclear: 1, big: 1 });
  assert.deepEqual(whyLabels({ nuclear: 1, big: 1 }), ['WTF???']); // a rock: its chip alone
  assert.equal(whyChips({ nuclear: 1 })[0]!.spoken, 'Historic performance'); // what screen readers hear
});

test('why: no spicy rock in a blowout, the historic night keeps its flame', () => {
  const g = { ...flat, players: [player(70), player(40)] };
  assert.ok(displayScore(g) < 50);
  assert.deepEqual(whyOf(g), { crazy: 1, big: 1 });
  // Same for a duel
  assert.deepEqual(whyOf({ ...flat, players: [player(49), player(52)] }), { huge: 2 });
});

test('why: a duel, two players each at the duel efficiency or the duel points, all nuclear', () => {
  // Example: 48 for a duel (efficiency or points), 56 for crazy, 46 for huge
  assert.deepEqual(whyOf({ ...close, players: [player(49), player(52), player(40)] }), { nuclear: 2, big: 1 });
  assert.deepEqual(whyOf({ ...close, players: [player(52), player(47)] }), { huge: 2 }); // only one at 48+
  assert.deepEqual(whyLabels({ nuclear: 2 }), ['WTF???']); // never counted on screen
  assert.equal(whyChips({ nuclear: 2 })[0]!.spoken, '2 historic performances');
  // A scorer at the duel points with a modest efficiency…
  const scorer: PlayerLine = { ...player(0), pts: 50, fgm: 17, fga: 38, ftm: 10, fta: 12, tov: 4 };
  assert.deepEqual(whyOf({ ...close, players: [scorer, { ...scorer, team: 'away' }] }), { nuclear: 2 });
  // …and one at the duel efficiency: a mixed duel
  assert.deepEqual(whyOf({ ...close, players: [scorer, player(50)] }), { nuclear: 2 });
  assert.deepEqual(whyOf({ ...close, players: [scorer] }), { big: 1 }); // alone: a big night (50 points ≥ 41)
});

test('why: a big night capped by a buzzer beater is nuclear', () => {
  // Example: a big night at 37 of efficiency or 41 points
  const shooter: PlayerLine = { ...player(38), id: 7 };
  const late = { ...close.late!, buzzerBeater: 7 };
  assert.deepEqual(whyOf({ ...close, late, players: [shooter, player(20)] }), { nuclear: 1 });
  // The buzzer beater of somebody else, or without a big night: nothing more
  assert.deepEqual(whyOf({ ...close, late: { ...late, buzzerBeater: 8 }, players: [shooter] }), { big: 1 });
  assert.equal(whyOf({ ...close, late, players: [{ ...player(20), id: 7 }] }), undefined);
});

test('why: a personal peak (his top 1%, above the floor, same stat) is nuclear', () => {
  // Floors 50 efficiency / 48 points; player 7: top 1% at 47 efficiency, 44 points
  usePeaks({ eff: 50, pts: 48, players: { 7: [47, 44] } });
  try {
    // 51 efficiency: above his top 1% and the floor
    assert.deepEqual(whyOf({ ...close, players: [{ ...player(51), pts: 30, reb: 21, id: 7 }] }), { nuclear: 1 });
    // 48 points at a modest efficiency: points side
    const scorer: PlayerLine = { ...player(0), id: 7, pts: 48, fgm: 17, fga: 40, ftm: 10, fta: 12, tov: 4 };
    assert.deepEqual(whyOf({ ...close, players: [scorer] }), { nuclear: 1 });
    // Above his top 1% but under the floor: a flame only
    assert.deepEqual(whyOf({ ...close, players: [{ ...player(49), pts: 30, reb: 19, id: 7 }] }), { huge: 1 });
    // Another player (no bar), or a blowout: nothing personal
    assert.deepEqual(whyOf({ ...close, players: [{ ...player(51), id: 8 }] }), { huge: 1 });
    assert.deepEqual(whyOf({ ...flat, players: [{ ...player(51), id: 7 }] }), { huge: 1 });
  } finally {
    usePeaks(null);
  }
  assert.throws(() => usePeaks({ eff: 50, players: {} }), /must be numbers/);
  assert.throws(() => usePeaks({ eff: 50, pts: 48, players: { 7: [47] } }), /bad entry/);
});

test('why: a night of threes is nuclear (example: 11 threes)', () => {
  const shooter: PlayerLine = { ...player(0), pts: 41, fgm: 14, fga: 30, fg3m: 11, ftm: 2, fta: 2, tov: 2 };
  assert.deepEqual(whyOf({ ...close, players: [shooter] }), { nuclear: 1 });
  assert.deepEqual(whyOf({ ...close, players: [{ ...shooter, fg3m: 10 }] }), { big: 1 }); // 41 points: a flame
  assert.deepEqual(whyOf({ ...flat, players: [shooter] }), { big: 1 }); // a blowout: never a rock
});
