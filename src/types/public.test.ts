// src/types/public.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from './public.ts';

test('game state: rated, waiting for more stats, live, upcoming', () => {
  const now = Date.parse('2026-11-05T03:00:00Z');
  const base = { away: 'DAL', home: 'SAS', tipOff: '2026-11-05T01:00:00Z' };
  assert.equal(gameState({ ...base, note: 80 }, now), 'rated');
  assert.equal(gameState({ ...base, waiting: true }, now), 'waiting');
  assert.equal(gameState({ ...base, note: 80, waiting: true }, now), 'rated'); // the rating wins
  assert.equal(gameState(base, now), 'live');
  assert.equal(gameState({ ...base, tipOff: '2026-11-05T04:00:00Z' }, now), 'upcoming');
});
