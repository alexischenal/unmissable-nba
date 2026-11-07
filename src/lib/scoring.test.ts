// src/lib/scoring.test.ts — run with: npm test
// With the example settings (EXAMPLE_SCORING): never the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeByClutch, closeFinalMargin, competitivenessDetails, disputedBaseFor, efficiency, isDisputed, playerPoints, rawScore } from './scoring.ts';
import { SCORING } from '../config/scoring.ts';
import type { PlayerLine } from '../types/game.ts';
import { sasAtDen } from '../../fixtures/2026-04-04-sas-den.ts';
import { detAtPhi } from '../../fixtures/2026-04-04-det-phi.ts';

test('v1: without play-by-play, nothing changes', () => {
  assert.equal(sasAtDen.late, undefined);
  // 122.2 before the comeback bonus, + 0.8 (the loser led by 13, 1 point beyond the example's 12)
  assert.equal(Math.round(rawScore(sasAtDen) * 10) / 10, 123);
});

test('v2: the suspense comes from the clutch time, the scenario from the weighted swings', () => {
  const half = { ...sasAtDen, late: { clutchSeconds: 120, marginAt2: 2, weightedSwings: 12 } }; // example: full at 240 s, 24
  const d = competitivenessDetails(half);
  assert.equal(d.suspense.share, 0.5);
  assert.equal(d.scenario.share, 0.5);
  const full = { ...sasAtDen, late: { clutchSeconds: 600, marginAt2: 0, weightedSwings: 40 } };
  assert.equal(competitivenessDetails(full).suspense.share, 1);
});

test('v2: a blowout by the final margin, but tight at the end, is a close game from the full base', () => {
  assert.equal(isDisputed(detAtPhi), false); // 23-point margin
  const tightEnd = { ...detAtPhi, late: { clutchSeconds: 0, marginAt2: 3, weightedSwings: 0 } }; // example: ≤ 4 at 2:00
  assert.equal(closeByClutch(tightEnd), true);
  assert.equal(isDisputed(tightEnd), true);
  assert.equal(disputedBaseFor(tightEnd), 50);
  const stillBlowout = { ...detAtPhi, late: { clutchSeconds: 0, marginAt2: 12, weightedSwings: 0 } };
  assert.equal(isDisputed(stillBlowout), false);
  // One second of clutch (within 5 in the last 5 minutes) is enough: full base
  const oneSecond = { ...detAtPhi, late: { clutchSeconds: 1, marginAt2: 12, weightedSwings: 0 } };
  assert.equal(isDisputed(oneSecond), true);
  assert.equal(disputedBaseFor(oneSecond), 50);
});

test('v2: still playable with 6:00 left (example: within 11) is competitive, lower base', () => {
  const late = (marginAt6: number) => ({ ...detAtPhi, late: { clutchSeconds: 0, marginAt2: 15, weightedSwings: 0, marginAt6 } });
  assert.equal(isDisputed(late(11)), true);
  assert.equal(disputedBaseFor(late(11)), 42); // example q3OnlyBase
  assert.equal(isDisputed(late(12)), false);
  // v2 no longer looks at the margin after Q3: a game within 1 after Q3, out of reach at 6:00, is a blowout
  const q3Close = {
    ...detAtPhi, biggestLead: { home: 21, away: 2 },
    periods: [{ home: 30, away: 30 }, { home: 25, away: 25 }, { home: 25, away: 24 }, { home: 35, away: 15 }],
  };
  assert.equal(isDisputed(q3Close), true); // v1: the margin after Q3
  assert.equal(isDisputed({ ...q3Close, late: { clutchSeconds: 0, marginAt2: 18, weightedSwings: 0, marginAt6: 16 } }), false);
});

test('garbage time: a close final margin only counts if the game was within reach late', () => {
  // Home up 20 after Q3, the visitors cut it to 6 at the buzzer; they never led by more than 3
  const g = {
    ...detAtPhi,
    periods: [{ home: 30, away: 20 }, { home: 30, away: 25 }, { home: 30, away: 25 }, { home: 20, away: 34 }],
    biggestLead: { home: 24, away: 3 },
  };
  const late = (marginAt2: number, clutchSeconds: number) => ({ ...g, late: { clutchSeconds, marginAt2, weightedSwings: 0 } });
  assert.equal(closeFinalMargin(g), true);                 // v1: the final margin alone, as before
  assert.equal(closeFinalMargin(late(14, 0)), false);      // decided at 2:00, never within 5: garbage time
  assert.equal(isDisputed(late(14, 0)), false);
  assert.equal(closeFinalMargin(late(14, 7)), true);       // within 5 for a few seconds: a real run
  assert.equal(closeFinalMargin(late(11, 0)), true);       // example limit: 11 at 2:00 still counts
  assert.equal(closeFinalMargin(late(12, 0)), false);
});

test('comeback: linear up to fullAt, then a bonus per extra point, uncapped', () => {
  const lead = (n: number) => ({ ...sasAtDen, biggestLead: { home: 0, away: n } }); // SAS lost: its lead counts
  const pts = (n: number) => competitivenessDetails(lead(n)).comeback.points;
  assert.equal(pts(6), 3);                            // example: weight 6, full at 12
  assert.equal(pts(12), 6);
  assert.equal(Math.round(pts(29) * 10) / 10, 19.6); // 6 + 17 × 0.8
});

test('performance: a big scoring night counts on its points minus the gap (example: 6) when that is higher', () => {
  // 53 points at 41 efficiency: counts as 47 (53 − 6), not 41
  const chucker: PlayerLine = { team: 'home', pts: 53, reb: 4, ast: 4, stl: 0, blk: 0, fgm: 17, fga: 33, ftm: 14, fta: 16, tov: 4 };
  const { threshold, divisor } = SCORING.performance;
  assert.equal(playerPoints(chucker), (53 - 6 - threshold) ** 2 / divisor);
  // An efficient night: efficiency wins, nothing changes
  const allround: PlayerLine = { team: 'home', pts: 30, reb: 15, ast: 12, stl: 2, blk: 1, fgm: 12, fga: 18, ftm: 6, fta: 7, tov: 2 };
  assert.equal(playerPoints(allround), (efficiency(allround) - threshold) ** 2 / divisor);
});
