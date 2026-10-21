// scripts/nba/adapter.ts
// Translates nba.com's raw format into the in-house Game type.
// If the NBA changes its format, this is the only file to fix.
// Every field is checked: an unexpected format makes the script fail
// rather than publish wrong ratings.

import type { Game, PlayerLine, Side } from '../../src/types/game.ts';
import type { RawBoxscore, RawBoxscoreTeam, RawSchedule, RawScheduleGame } from './types.ts';

// Ranked game types, based on the gameId prefix:
// 001 preseason, 002 regular season, 003 All-Star, 004 playoffs, 005 play-in, 006 NBA Cup final.
const RANKED_PREFIXES = ['002', '004', '005', '006'];

const num = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Unexpected NBA format: "${label}" is ${JSON.stringify(value)}`);
  }
  return value;
};

// '10/20/2026 00:00:00' → '2026-10-20'
export const scheduleDateToIso = (raw: string): string => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : raw.slice(0, 10);
};

// Teams still to be decided (e.g. the games set after the NBA Cup group stage) come with null
// tricodes and a placeholder tip-off: never published until the NBA fills them in.
export const teamsKnown = (g: RawScheduleGame): boolean =>
  Boolean(g.homeTeam?.teamTricode && g.awayTeam?.teamTricode);

export function allGamesOnDate(schedule: RawSchedule, isoDate: string): RawScheduleGame[] {
  const day = schedule.leagueSchedule.gameDates.find((d) => scheduleDateToIso(d.gameDate) === isoDate);
  const games = day?.games ?? [];
  return games.filter((g) => RANKED_PREFIXES.some((prefix) => g.gameId.startsWith(prefix)));
}

// The night's games the site can show: ranked, with both teams known.
export const gamesOnDate = (schedule: RawSchedule, isoDate: string): RawScheduleGame[] =>
  allGamesOnDate(schedule, isoDate).filter(teamsKnown);

export const isFinal = (box: RawBoxscore): boolean => box.game.gameStatus === 3;

function toPlayers(team: RawBoxscoreTeam, side: Side): PlayerLine[] {
  return team.players.map((p, i) => {
    const s = p.statistics;
    const label = `${team.teamTricode} player ${i}`;
    return {
      team: side,
      ...(p.name ? { name: p.name } : {}),
      pts: num(s.points, `${label} points`),
      reb: num(s.reboundsTotal, `${label} reboundsTotal`),
      ast: num(s.assists, `${label} assists`),
      stl: num(s.steals, `${label} steals`),
      blk: num(s.blocks, `${label} blocks`),
      fgm: num(s.fieldGoalsMade, `${label} fieldGoalsMade`),
      fga: num(s.fieldGoalsAttempted, `${label} fieldGoalsAttempted`),
      ftm: num(s.freeThrowsMade, `${label} freeThrowsMade`),
      fta: num(s.freeThrowsAttempted, `${label} freeThrowsAttempted`),
      tov: num(s.turnovers, `${label} turnovers`),
    };
  });
}

export function toGame(box: RawBoxscore): Game {
  const { homeTeam: home, awayTeam: away, gameId } = box.game;

  const byPeriod = (t: RawBoxscoreTeam) => [...t.periods].sort((a, b) => a.period - b.period);
  const homePeriods = byPeriod(home);
  const awayPeriods = byPeriod(away);
  if (homePeriods.length !== awayPeriods.length) {
    throw new Error(`Game ${gameId}: the two teams have a different number of periods`);
  }

  // The 4 quarters, then only the overtimes actually played
  const periods = homePeriods
    .map((p, i) => ({
      home: num(p.score, `${gameId} period ${p.period} home`),
      away: num(awayPeriods[i]?.score, `${gameId} period ${p.period} away`),
    }))
    .filter((p, i) => i < 4 || p.home + p.away > 0);

  // Safety check: the periods must add up to the final score
  const total = (side: 'home' | 'away') => periods.reduce((acc, p) => acc + p[side], 0);
  if (total('home') !== num(home.score, `${gameId} home score`) || total('away') !== num(away.score, `${gameId} away score`)) {
    throw new Error(`Game ${gameId}: the periods don't add up to the final score`);
  }

  return {
    home: home.teamTricode,
    away: away.teamTricode,
    periods,
    // Game-level data: identical on the home and away side
    leadChanges: num(home.statistics.leadChanges, `${gameId} leadChanges`),
    timesTied: num(home.statistics.timesTied, `${gameId} timesTied`),
    biggestLead: {
      home: num(home.statistics.biggestLead, `${gameId} biggestLead home`),
      away: num(away.statistics.biggestLead, `${gameId} biggestLead away`),
    },
    players: [...toPlayers(home, 'home'), ...toPlayers(away, 'away')],
  };
}
