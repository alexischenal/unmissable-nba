// src/lib/empty.ts
// The "no games last night" screen: when the home page night is over and a whole night went by without
// games (a day off, the All-Star break, the off-season). Pure functions, tested in empty.test.ts.

import type { NightJson } from '../types/public.ts';

const HOUR = 60 * 60 * 1000;
// A night is "last night" for a day: from its last tip-off, about 3 hours of game, then 24 hours.
const STALE_AFTER = 27 * HOUR;

function shiftDay(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const tipOffs = (night: NightJson) =>
  night.games.flatMap((g) => (g.tipOff ? [Date.parse(g.tipOff)] : [])).filter((t) => !Number.isNaN(t));

// When the home page night stops being "last night": 27 hours after its last tip-off.
// Without tip-off times (old files), the next day at noon UTC + 24 hours.
export function staleAt(night: NightJson): number {
  const times = tipOffs(night);
  return times.length > 0
    ? Math.max(...times) + STALE_AFTER
    : Date.parse(`${shiftDay(night.date, 1)}T12:00:00Z`) + 24 * HOUR;
}

// The empty screen replaces the night: once it's stale, until the next night's first tip-off
// (the site then switches to the new night by itself). With no next night (off-season), for good.
export function isEmptyNow(night: NightJson, next: NightJson | null, now: number): boolean {
  if (now < staleAt(night)) return false;
  if (!next) return true;
  const first = tipOffs(next);
  return first.length === 0 || now < Math.min(...first);
}

// The night that just went by without games, for the header: the eve of the next night
// (several days off: the last one), or the day after the home page night with no next night.
export const emptyNightDate = (night: NightJson, next: NightJson | null): string =>
  next ? shiftDay(next.date, -1) : shiftDay(night.date, 1);
