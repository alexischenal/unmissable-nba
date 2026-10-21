// scripts/nba/order.ts
// The order of the games in the public JSON. Pure function, tested in order.test.ts.
//
//   1. rated games, best first;
//   2. then the others, by tip-off time.
//
// Ties on the displayed rating (two 100s):
//   - two games rated in the same run: the raw rating decides;
//   - otherwise, the game already published keeps its place.
// The raw rating is never written to the JSON: with the public box scores, enough of them
// would let anyone work out the algorithm's settings.

import type { PublicGame } from '../../src/types/public.ts';

// A game as the script builds it: the public fields, plus the raw rating of a game rated in this run.
export type Entry = PublicGame & { raw?: number };

export function orderGames(previous: PublicGame[], entries: Entry[]): PublicGame[] {
  const key = (g: PublicGame) => `${g.away}@${g.home}`;
  const previousIndex = new Map(previous.map((g, i) => [key(g), i]));
  const indexOf = (g: Entry) => previousIndex.get(key(g)) ?? Number.POSITIVE_INFINITY;

  const rated = entries
    .filter((g) => g.note !== undefined)
    .sort((a, b) =>
      b.note! - a.note!
      || (a.raw !== undefined && b.raw !== undefined ? b.raw - a.raw : 0)
      || indexOf(a) - indexOf(b));

  const tip = (g: Entry) => (g.tipOff ? Date.parse(g.tipOff) : Number.POSITIVE_INFINITY);
  const unrated = entries
    .filter((g) => g.note === undefined)
    .sort((a, b) => tip(a) - tip(b) || key(a).localeCompare(key(b)));

  // Only the public fields leave this function
  return [...rated, ...unrated].map(({ raw: _raw, ...game }) => game);
}
