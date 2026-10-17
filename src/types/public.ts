// src/types/public.ts
// The public JSON read by the site. Zero spoilers, guaranteed by the architecture:
// it ONLY contains the teams and the displayed rating, never the score.

export type PublicGame = {
  away: string; // abbreviation, e.g. 'SAS'
  home: string; // e.g. 'DEN'
  note: number; // displayed rating, 0 to 100
};

export type NightJson = {
  version: 1;
  date: string; // US date of the games, YYYY-MM-DD
  games: PublicGame[]; // already sorted, most recommended first
};
