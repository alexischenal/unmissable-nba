// scripts/nba/adapter.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allGamesOnDate, gamesOnDate, nextNightWithGames } from './adapter.ts';
import type { RawSchedule } from './types.ts';

const game = (gameId: string, away: string | null, home: string | null) =>
  ({ gameId, gameStatus: 1, gameDateTimeUTC: '2026-12-04T05:00:00Z', awayTeam: { teamTricode: away }, homeTeam: { teamTricode: home } });

const SCHEDULE = {
  leagueSchedule: {
    seasonYear: '2026-27',
    gameDates: [{
      gameDate: '12/04/2026 00:00:00',
      games: [game('0022600300', 'BOS', 'NYK'), game('0022600301', null, null), game('0012600001', 'LAL', 'GSW')],
    }],
  },
} as unknown as RawSchedule;

test('games with teams still to be decided are never published', () => {
  assert.deepEqual(gamesOnDate(SCHEDULE, '2026-12-04').map((g) => g.gameId), ['0022600300']);
  // allGamesOnDate still sees them (for check-window), but never preseason games
  assert.deepEqual(allGamesOnDate(SCHEDULE, '2026-12-04').map((g) => g.gameId), ['0022600300', '0022600301']);
});

test('the next night with games skips days off and the All-Star Game', () => {
  const day = (date: string, games: unknown[]) => ({ gameDate: `${date} 00:00:00`, games });
  const schedule = {
    leagueSchedule: {
      seasonYear: '2026-27',
      gameDates: [
        day('02/12/2027', [game('0022600800', 'BOS', 'NYK')]),
        day('02/13/2027', []),
        day('02/14/2027', [game('0032600001', 'EST', 'WST')]), // All-Star Game: not ranked
        day('02/18/2027', [game('0022600801', 'LAL', 'GSW')]),
      ],
    },
  } as unknown as RawSchedule;
  assert.equal(nextNightWithGames(schedule, '2027-02-12'), '2027-02-18');
  assert.equal(nextNightWithGames(schedule, '2027-02-18'), null);
});
