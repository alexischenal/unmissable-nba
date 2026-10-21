// scripts/nba/types.ts
// (Partial) shape of the public JSON files on cdn.nba.com, the ones nba.com itself uses.
// Undocumented: only the fields read by the adapter are described here.

export type RawScheduleGame = {
  gameId: string; // e.g. '0022600001' — '002' = regular season
  gameStatus: number; // 1 = scheduled, 2 = live, 3 = final
  gameDateEst?: string; // e.g. '2026-10-20T00:00:00Z'
  gameDateTimeUTC?: string; // tip-off, e.g. '2026-10-20T19:00:00Z'
  homeTeam: { teamTricode: string };
  awayTeam: { teamTricode: string };
};

export type RawSchedule = {
  leagueSchedule: {
    seasonYear: string;
    gameDates: {
      gameDate: string; // e.g. '10/20/2026 00:00:00'
      games: RawScheduleGame[];
    }[];
  };
};

export type RawPlayerStatistics = {
  points: number;
  reboundsTotal: number;
  assists: number;
  steals: number;
  blocks: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  turnovers: number;
};

export type RawBoxscoreTeam = {
  teamTricode: string;
  score: number;
  periods: { period: number; periodType: string; score: number }[];
  players: { name?: string; statistics: RawPlayerStatistics }[];
  statistics: {
    biggestLead: number;
    leadChanges: number;
    timesTied: number;
  };
};

export type RawBoxscore = {
  game: {
    gameId: string;
    gameStatus: number;
    homeTeam: RawBoxscoreTeam;
    awayTeam: RawBoxscoreTeam;
  };
};
