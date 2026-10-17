// fixtures/2026-04-04-was-mia.ts
// Real game: Washington @ Miami, April 4, 2026 (136-152).
// Sources: official NBA box score and Basketball-Reference. Test data, outside the app.

import type { Game, PlayerLine } from '../src/types/game.ts';

const p = (team: 'home' | 'away', pts: number, reb: number, ast: number, stl: number, blk: number,
  fgm: number, fga: number, ftm: number, fta: number, tov: number): PlayerLine =>
  ({ team, pts, reb, ast, stl, blk, fgm, fga, ftm, fta, tov });

export const wasAtMia: Game = {
  home: 'MIA',
  away: 'WAS',
  periods: [
    { home: 36, away: 32 },
    { home: 41, away: 25 },
    { home: 45, away: 34 },
    { home: 30, away: 45 },
  ],
  leadChanges: 10,
  timesTied: 4,
  biggestLead: { home: 35, away: 2 },
  players: [
    // Wizards
    p('away', 31, 5, 0, 5, 0, 12, 17, 5, 6, 0),  // Riley
    p('away', 11, 2, 5, 2, 0, 4, 13, 0, 1, 2),   // Carrington
    p('away', 11, 3, 4, 0, 0, 5, 13, 0, 0, 2),   // T. Johnson
    p('away', 12, 3, 2, 2, 3, 5, 13, 2, 4, 0),   // Coulibaly
    p('away', 6, 5, 3, 0, 0, 2, 5, 2, 2, 0),     // Gill
    p('away', 20, 2, 7, 0, 0, 6, 10, 5, 6, 3),   // Cooper
    p('away', 19, 2, 2, 1, 1, 7, 15, 0, 0, 2),   // Hardy
    p('away', 12, 10, 2, 1, 0, 4, 9, 3, 3, 0),   // J. Champagnie
    p('away', 14, 3, 1, 1, 1, 5, 8, 2, 2, 0),    // Watkins
    p('away', 0, 9, 2, 0, 0, 0, 2, 0, 0, 0),     // Reese
    p('away', 0, 0, 0, 0, 0, 0, 1, 0, 0, 0),     // Black
    // Heat
    p('home', 21, 2, 3, 1, 1, 7, 11, 3, 4, 1),   // Wiggins
    p('home', 12, 4, 6, 0, 0, 5, 9, 0, 0, 1),    // Mitchell
    p('home', 14, 9, 7, 1, 0, 3, 6, 6, 7, 2),    // Adebayo
    p('home', 16, 7, 4, 0, 1, 6, 10, 4, 6, 3),   // Larsson
    p('home', 8, 1, 4, 1, 0, 3, 4, 0, 0, 1),     // Fontecchio
    p('home', 24, 19, 2, 0, 7, 10, 15, 1, 2, 1), // Ware
    p('home', 32, 3, 4, 1, 0, 12, 18, 7, 7, 2),  // Jaquez Jr.
    p('home', 14, 3, 9, 0, 2, 4, 9, 4, 6, 3),    // Jakucionis
    p('home', 5, 0, 2, 0, 0, 2, 6, 0, 0, 0),     // Jovic
    p('home', 6, 0, 1, 2, 0, 2, 5, 2, 2, 0),     // D. Smith
    p('home', 0, 1, 0, 0, 0, 0, 0, 0, 0, 0),     // K. Johnson
  ],
};
