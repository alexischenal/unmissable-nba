// scripts/nba/periodStats.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstThreeQuarters, lineOver, mismatches, periodStats } from './periodStats.ts';
import { efficiency } from '../../src/lib/scoring.ts';
import type { PlayerLine } from '../../src/types/game.ts';

const act = (period: number, actionType: string, personId: number, extra: object = {}) =>
  ({ period, clock: 'PT05M00.00S', actionType, personId, scoreHome: '0', scoreAway: '0', ...extra });

const raw = {
  game: {
    gameId: 'x',
    actions: [
      act(1, '3pt', 7, { shotResult: 'Made', assistPersonId: 9 }),
      act(1, '2pt', 7, { shotResult: 'Missed' }),
      act(1, 'block', 5),
      act(1, 'rebound', 9),
      act(1, 'rebound', 0),                                // a team rebound: nobody
      act(2, 'freethrow', 7, { shotResult: 'Made', subType: '1 of 2' }),
      act(2, 'freethrow', 7, { shotResult: 'Missed', subType: '2 of 2' }),
      act(2, 'turnover', 7),
      act(2, 'steal', 5),
      act(4, '2pt', 7, { shotResult: 'Made' }),
      act(4, 'substitution', 7),
    ],
  },
};

test('period stats: each player\'s line in each period, from the full play-by-play', () => {
  const s = periodStats(raw);
  // [pts, reb, ast, stl, blk, fgm, fga, ftm, fta, tov]
  assert.deepEqual(s['7'], [[3, 0, 0, 0, 0, 1, 2, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 1, 2, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [2, 0, 0, 0, 0, 1, 1, 0, 0, 0]]);
  assert.deepEqual(s['9'], [[0, 1, 1, 0, 0, 0, 0, 0, 0, 0]]);
  assert.deepEqual(s['5'], [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0, 0, 0, 0]]);
  assert.equal(s['0'], undefined);
});

test('period stats: a line over the first three quarters, and the check against the box score', () => {
  const s = periodStats(raw);
  const box: PlayerLine = { team: 'home', id: 7, pts: 6, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 2, fga: 3, ftm: 1, fta: 2, tov: 1 };
  const q13 = lineOver(s, box, 1, 3)!;
  assert.equal(q13.pts, 4);
  assert.equal(efficiency(q13), 4 - 1 - 1 - 1); // 4 pts − 1 missed FG − 1 missed FT − 1 turnover
  assert.deepEqual(mismatches(s, box), []);
  assert.deepEqual(mismatches(s, { ...box, reb: 2 }), ['reb 0/2']);
  // Steals and blocks carried by the turnover / the missed shot when the feed has no own actions
  const old = periodStats({ game: { gameId: 'y', actions: [act(1, 'turnover', 7, { stealPersonId: 5 }), act(1, '2pt', 7, { shotResult: 'Missed', blockPersonId: 5 })] } });
  assert.deepEqual(old['5'], [[0, 0, 0, 1, 1, 0, 0, 0, 0, 0]]);
});

test('period stats: each player\'s points and efficiency over the first three quarters', () => {
  const s = periodStats(raw);
  const box: PlayerLine = { team: 'home', id: 7, pts: 6, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 2, fga: 3, ftm: 1, fta: 2, tov: 1 };
  const game = { home: 'A', away: 'B', periods: [], leadChanges: 0, timesTied: 0, biggestLead: { home: 0, away: 0 }, players: [box, { ...box, id: undefined }] };
  assert.deepEqual(firstThreeQuarters(s, game), [{ id: 7, pts: 4, eff: 1 }]);
});
