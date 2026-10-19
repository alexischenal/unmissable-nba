// scripts/nba/order.ts
// The order of the games in the public JSON. Pure function, tested in order.test.ts.
//
//   1. rated games, best first;
//   2. then the others, by tip-off time.
//
// Ties on the displayed rating (two 100s) are broken by the raw rating, kept in the JSON.
// Files written before the raw rating existed don't have it: the earlier game keeps its place.

import type { PublicGame } from '../../src/types/public.ts';

export type Entry = PublicGame;

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

  return [...rated, ...unrated];
}
