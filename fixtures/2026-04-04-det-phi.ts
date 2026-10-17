// fixtures/2026-04-04-det-phi.ts
// Real game: Detroit @ Philadelphia, April 4, 2026 (116-93).
// Sources: official NBA box score and Basketball-Reference. Test data, outside the app.

import type { Game, PlayerLine } from '../src/types/game.ts';

const p = (team: 'home' | 'away', pts: number, reb: number, ast: number, stl: number, blk: number,
  fgm: number, fga: number, ftm: number, fta: number, tov: number): PlayerLine =>
  ({ team, pts, reb, ast, stl, blk, fgm, fga, ftm, fta, tov });

export const detAtPhi: Game = {
  home: 'PHI',
  away: 'DET',
  periods: [
    { home: 31, away: 41 },
    { home: 29, away: 30 },
    { home: 21, away: 24 },
    { home: 12, away: 21 },
  ],
  leadChanges: 5,
  timesTied: 5,
  biggestLead: { home: 2, away: 26 },
  players: [
    // Pistons
    p('away', 16, 4, 14, 1, 1, 4, 11, 6, 7, 1),  // Jenkins
    p('away', 16, 7, 3, 0, 0, 5, 8, 6, 7, 1),    // Duren
    p('away', 19, 4, 2, 4, 0, 7, 13, 4, 4, 1),   // Harris
    p('away', 14, 5, 2, 3, 1, 7, 11, 0, 0, 4),   // A. Thompson
    p('away', 11, 2, 2, 0, 0, 4, 7, 0, 0, 0),    // Robinson
    p('away', 5, 5, 6, 0, 0, 2, 9, 0, 0, 2),     // Huerter
    p('away', 7, 2, 3, 1, 0, 3, 6, 0, 0, 1),     // LeVert
    p('away', 11, 6, 0, 1, 1, 4, 10, 1, 2, 0),   // Holland
    p('away', 10, 7, 0, 2, 1, 4, 5, 2, 4, 1),    // Reed
    p('away', 5, 2, 1, 0, 0, 2, 4, 0, 0, 0),     // Sasser
    p('away', 2, 1, 0, 0, 0, 1, 2, 0, 0, 0),     // Green
    p('away', 0, 0, 0, 0, 0, 0, 1, 0, 0, 0),     // Lanier
    // 76ers
    p('home', 19, 6, 1, 2, 1, 7, 18, 3, 4, 3),   // Edgecombe
    p('home', 23, 1, 1, 1, 0, 8, 17, 5, 7, 2),   // Maxey
    p('home', 20, 5, 4, 2, 0, 7, 14, 3, 4, 3),   // George
    p('home', 3, 4, 1, 1, 0, 1, 4, 0, 0, 1),     // Oubre Jr.
    p('home', 4, 3, 2, 1, 0, 2, 5, 0, 0, 1),     // Drummond
    p('home', 8, 2, 2, 0, 1, 3, 6, 2, 2, 2),     // Barlow
    p('home', 10, 4, 2, 0, 0, 5, 5, 0, 0, 1),    // Bona
    p('home', 0, 3, 1, 0, 0, 0, 4, 0, 0, 1),     // Grimes
    p('home', 0, 0, 0, 1, 0, 0, 2, 0, 0, 0),     // J. Edwards
    p('home', 2, 3, 1, 0, 0, 1, 3, 0, 0, 0),     // Payne
    p('home', 4, 1, 2, 0, 0, 1, 1, 2, 2, 1),     // Watford
    p('home', 0, 1, 0, 0, 0, 0, 0, 0, 0, 0),     // Walker
    p('home', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),     // Beauchamp
  ],
};
