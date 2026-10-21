// scripts/nba/schedule-cache.ts
// The season schedule (several MB) is only downloaded once per night, not on every run.
//
// The first run of a night (from 06:00 New York time, see plan.ts) downloads it and keeps only the
// nights the script can need: the previous one, the current one and the next two. That small copy
// (a few KB) is .cache/schedule.json, which GitHub Actions keeps between runs (actions/cache, keyed
// by night). Every other run of that night reads it instead of calling nba.com.
//
// Trade-off: a tip-off time changed by the NBA during the day is only picked up the next night.

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { fetchSchedule } from './client.ts';
import { scheduleDateToIso } from './adapter.ts';
import { currentNight, nextDay, previousDay } from './plan.ts';
import type { RawSchedule } from './types.ts';

type Cached = { night: string; schedule: RawSchedule };

export function nightsKept(night: string): string[] {
  return [previousDay(night), night, nextDay(night), nextDay(nextDay(night))];
}

// Only the game days the script can need, in the same format as the full schedule
export function trimSchedule(full: RawSchedule, night: string): RawSchedule {
  const keep = new Set(nightsKept(night));
  return {
    leagueSchedule: {
      ...full.leagueSchedule,
      gameDates: full.leagueSchedule.gameDates.filter((d) => keep.has(scheduleDateToIso(d.gameDate))),
    },
  };
}

export async function loadSchedule(now: Date, cacheFile: string): Promise<RawSchedule> {
  const night = currentNight(now);
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, 'utf8')) as Cached;
      if (cached.night === night && Array.isArray(cached.schedule?.leagueSchedule?.gameDates)) {
        console.log(`NBA schedule: cached copy (night of ${night}).`);
        return cached.schedule;
      }
    } catch {
      // Unreadable cache: download again
    }
  }
  console.log('NBA schedule: downloading…');
  const schedule = trimSchedule(await fetchSchedule(), night);
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify({ night, schedule } satisfies Cached));
  console.log(`NBA schedule: kept ${schedule.leagueSchedule.gameDates.length} game day(s) for the night of ${night}.`);
  return schedule;
}
