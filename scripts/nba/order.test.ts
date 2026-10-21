// scripts/nba/order.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderGames } from './order.ts';

const names = (games: { away: string }[]) => games.map((g) => g.away);

test('rated games first, best first, then the others by tip-off', () => {
  const games = orderGames([], [
    { away: 'PHI', home: 'NYK', tipOff: '2026-10-20T23:00:00Z' },
    { away: 'BOS', home: 'DET', tipOff: '2026-10-20T19:00:00Z', note: 42 },
    { away: 'OKC', home: 'SAS', tipOff: '2026-10-21T01:30:00Z' },
    { away: 'LAL', home: 'GSW', tipOff: '2026-10-20T22:00:00Z', note: 77 },
  ]);
  assert.deepEqual(names(games), ['LAL', 'BOS', 'PHI', 'OKC']);
});

test('two 100s rated in the same run: the raw rating decides', () => {
  const games = orderGames([], [
    { away: 'A', home: 'B', note: 100, raw: 104 },
    { away: 'C', home: 'D', note: 100, raw: 123 },
  ]);
  assert.deepEqual(names(games), ['C', 'A']);
});

test('two 100s rated at different runs: the 100 already published keeps its place', () => {
  const previous = [{ away: 'A', home: 'B', note: 100 }];
  const games = orderGames(previous, [
    { away: 'C', home: 'D', note: 100, raw: 150 },
    { away: 'A', home: 'B', note: 100 },
  ]);
  assert.deepEqual(names(games), ['A', 'C']);
});

test('the raw rating never reaches the JSON', () => {
  const [game] = orderGames([], [{ away: 'A', home: 'B', note: 100, raw: 123.1 }]);
  assert.deepEqual(game, { away: 'A', home: 'B', note: 100 });
});

test('an old file with raw ratings: they are dropped, the order is kept', () => {
  const previous = [{ away: 'A', home: 'B', note: 100, raw: 104 }] as never[];
  const games = orderGames(previous, [
    { away: 'C', home: 'D', note: 100, raw: 150 },
    { away: 'A', home: 'B', note: 100 }, // fetch-night never carries an old raw rating over
  ]);
  assert.deepEqual(names(games), ['A', 'C']);
  assert.ok(games.every((g) => !('raw' in g)));
});
