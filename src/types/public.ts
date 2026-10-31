// src/types/public.ts
// The public JSON read by the site. Zero spoilers, guaranteed by the architecture:
// it ONLY contains the teams, the tip-off time and the ratings, never the score.

export type PublicGame = {
  away: string; // abbreviation, e.g. 'SAS'
  home: string; // e.g. 'DEN'
  tipOff?: string; // ISO time in UTC (version 2). Missing in version 1 files.
  note?: number; // displayed rating, 0 to 100 — only once the game is over
  // No raw rating here (some files from October 20, 2026 had one): see scripts/nba/order.ts.
  why?: Why; // where the rating comes from, shown under the "?" of a rated card
};

// Never a name, a team, a number or how the game ends: only what kind of game it was.
export type Why = {
  scenario?: true; // the story of the game: a tight finish, a big comeback, lead changes…
  huge?: number;   // players with a huge night
  big?: number;    // players with a big night (not huge)
};

export type NightJson = {
  // 1: the whole night at once, every game rated (files up to October 2026).
  // 2: published from the first tip-off on, each game rated as soon as it ends.
  version: 1 | 2;
  date: string; // US date of the games, YYYY-MM-DD
  // Rated games first (most recommended first), then the others by tip-off time.
  games: PublicGame[];
};

// A game's state, as the site shows it. "Live" isn't stored: tip-off passed and no rating yet.
export type GameState = 'upcoming' | 'live' | 'rated';

export function gameState(game: PublicGame, now: number): GameState {
  if (game.note !== undefined) return 'rated';
  if (game.tipOff && Date.parse(game.tipOff) > now) return 'upcoming';
  return 'live';
}

// The night is over once every game has its rating.
export const nightIsComplete = (night: NightJson): boolean =>
  night.games.every((g) => g.note !== undefined);
