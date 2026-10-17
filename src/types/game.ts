// src/types/game.ts
// The in-house type: the algorithm only knows this one, never an API's raw format.
// Every adapter (NBA, API-NBA…) must fill this contract.

export type Side = 'home' | 'away';

export type PlayerLine = {
  team: Side;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  tov: number;
};

export type Game = {
  home: string; // abbreviation, e.g. 'DEN'
  away: string; // e.g. 'SAS'
  periods: { home: number; away: number }[]; // Q1…Q4, then overtimes
  leadChanges: number;
  timesTied: number;
  biggestLead: { home: number; away: number };
  players: PlayerLine[];
};
