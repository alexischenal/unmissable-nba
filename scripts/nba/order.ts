// scripts/nba/order.ts
// The order of the games in the public JSON. Pure function, tested in order.test.ts.
//
//   1. rated games, best first;
//   2. then the others, by tip-off time.
//
// The raw rating (which can exceed 100) is only known for games rated during this run:
// it breaks ties between them. Between a game rated earlier and one rated now, the earlier
// one keeps its place.

import type { PublicGame } from '../../src/types/public.ts';

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

  return [...rated, ...unrated].map(({ raw: _raw, ...game }) => game);
}
