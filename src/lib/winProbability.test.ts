// src/lib/winProbability.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeWinProbability, phi, trailingChance } from './winProbability.ts';

const m = { homeEdge: 2.5, sigma: 19.5 };

test('the normal CDF', () => {
  assert.ok(Math.abs(phi(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(phi(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(phi(-1) - 0.1587) < 1e-4);
});

test('the home win probability: tip-off, the end, and the clock', () => {
  assert.ok(homeWinProbability(0, 2880, m) > 0.5);         // the home edge
  assert.equal(homeWinProbability(1, 0, m), 1);
  assert.equal(homeWinProbability(0, 0, m), 0.5);           // tied at the buzzer: overtime
  assert.ok(homeWinProbability(6, 60, m) > homeWinProbability(6, 600, m)); // the same lead weighs more late
});

test('a trailing team\'s chance: the lower of home and away', () => {
  const c = trailingChance(12, 360, m);
  assert.ok(c > 0.02 && c < 0.06);
  assert.ok(c <= homeWinProbability(-12, 360, m));
  assert.ok(trailingChance(6, 296, m) > trailingChance(6, 60, m));
});
