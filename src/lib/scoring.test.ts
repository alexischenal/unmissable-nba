// src/lib/scoring.test.ts — run with: npm test
// With the example settings (EXAMPLE_SCORING): never the real ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeByClutch, competitivenessDetails, disputedBaseFor, isDisputed, rawScore } from './scoring.ts';
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
  const stillBlowout = { ...detAtPhi, late: { clutchSeconds: 60, marginAt2: 12, weightedSwings: 0 } };
  assert.equal(isDisputed(stillBlowout), false);
});

test('comeback: linear up to fullAt, then a bonus per extra point, uncapped', () => {
  const lead = (n: number) => ({ ...sasAtDen, biggestLead: { home: 0, away: n } }); // SAS lost: its lead counts
  const pts = (n: number) => competitivenessDetails(lead(n)).comeback.points;
  assert.equal(pts(6), 3);                            // example: weight 6, full at 12
  assert.equal(pts(12), 6);
  assert.equal(Math.round(pts(29) * 10) / 10, 19.6); // 6 + 17 × 0.8
});
