// fixtures/2026-04-04-sas-den.ts
// Real game: San Antonio @ Denver, April 4, 2026 (136-134 OT).
// Sources: official NBA box score (periods, lead changes, biggest leads)
// and Basketball-Reference (player stats). Test data, outside the app.

import type { Game, PlayerLine } from '../src/types/game.ts';

const p = (team: 'home' | 'away', pts: number, reb: number, ast: number, stl: number, blk: number,
  fgm: number, fga: number, ftm: number, fta: number, tov: number): PlayerLine =>
  ({ team, pts, reb, ast, stl, blk, fgm, fga, ftm, fta, tov });

export const sasAtDen: Game = {
  home: 'DEN',
  away: 'SAS',
  periods: [
    { home: 36, away: 43 },
    { home: 29, away: 29 },
    { home: 27, away: 24 },
    { home: 32, away: 28 },
    { home: 12, away: 10 }, // overtime
  ],
  leadChanges: 6,
  timesTied: 4,
  biggestLead: { home: 5, away: 13 },
  players: [
    // Spurs
    p('away', 14, 4, 4, 1, 0, 7, 19, 0, 0, 2),   // Fox
    p('away', 20, 5, 9, 0, 0, 9, 17, 2, 2, 4),   // Castle
    p('away', 34, 18, 7, 1, 5, 8, 17, 16, 17, 1), // Wembanyama
    p('away', 18, 5, 2, 0, 1, 6, 14, 3, 3, 0),   // Vassell
    p('away', 18, 5, 2, 0, 0, 6, 12, 0, 0, 0),   // Champagnie
    p('away', 12, 3, 3, 0, 0, 5, 7, 0, 1, 2),    // Harper
    p('away', 10, 2, 0, 0, 0, 3, 10, 4, 4, 0),   // K. Johnson
    p('away', 8, 1, 1, 1, 0, 3, 4, 0, 0, 1),     // Barnes
    p('away', 0, 5, 1, 1, 0, 0, 1, 0, 0, 0),     // Kornet
    p('away', 0, 2, 0, 1, 0, 0, 0, 0, 0, 0),     // Bryant
    // Nuggets
    p('home', 15, 4, 10, 1, 0, 6, 13, 0, 0, 2),  // Murray
    p('home', 40, 8, 13, 0, 3, 13, 25, 13, 15, 0), // Jokic
    p('home', 15, 6, 3, 0, 0, 7, 12, 0, 0, 2),   // Gordon
    p('home', 17, 7, 1, 2, 2, 6, 11, 1, 1, 1),   // C. Johnson
    p('home', 21, 8, 4, 0, 1, 7, 16, 2, 2, 0),   // Braun
    p('home', 10, 5, 0, 1, 0, 3, 6, 2, 2, 0),    // Hardaway Jr.
    p('home', 6, 1, 2, 0, 0, 2, 5, 0, 0, 0),     // Strawther
    p('home', 5, 2, 1, 1, 0, 2, 7, 0, 0, 1),     // B. Brown
    p('home', 7, 3, 0, 0, 0, 3, 6, 1, 2, 0),     // Valanciunas
    p('home', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),     // T. Jones
  ],
};
