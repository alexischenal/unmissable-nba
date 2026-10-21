// scripts/check-window.ts
// Is it safe to stop all runs during a daily window (UTC)? Reads the whole season's schedule
// and lists every game that needs runs during it: from its tip-off to 4 hours later (time to end,
// overtimes included, and be rated).
//
// Usage: npm run check-window                 → the default window, 08:00–15:00 UTC
//        npm run check-window -- 9 14         → another window (start and end hours, UTC)
//
// A game caught in the window wouldn't be lost (the next run catches up on the night), only late.

import { fetchSchedule } from './nba/client.ts';
import { allGamesOnDate, gamesOnDate, scheduleDateToIso, teamsKnown } from './nba/adapter.ts';

const NEEDS_RUNS_FOR_H = 4;

const [startH = 8, endH = 15] = process.argv.slice(2).map(Number);
const minutesOfDay = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Does [from, from + length) (minutes, can go past midnight) overlap [startH, endH)?
function overlaps(from: number, length: number): boolean {
  const ws = startH * 60, we = endH * 60;
  for (const shift of [0, -1440]) {
    const a = from + shift, b = from + length + shift;
    if (a < we && b > ws) return true;
  }
  return false;
}

const schedule = await fetchSchedule();
const dates = schedule.leagueSchedule.gameDates.map((d) => scheduleDateToIso(d.gameDate));
const games = dates.flatMap((date) => gamesOnDate(schedule, date).map((g) => ({ date, g })))
  .filter(({ g }) => g.gameDateTimeUTC);

const tips = games.map(({ g }) => minutesOfDay(new Date(g.gameDateTimeUTC!)));
// Tip-offs after noon UTC are "early" (US afternoon), the others "late" (US evening, past midnight UTC)
const early = tips.filter((m) => m >= 12 * 60);
const late = tips.filter((m) => m < 12 * 60);
const tbd = dates.flatMap((date) => allGamesOnDate(schedule, date).filter((g) => !teamsKnown(g)).map(() => date));
console.log(`${schedule.leagueSchedule.seasonYear}: ${games.length} games with a tip-off time.`);
if (tbd.length) {
  console.log(`Left out: ${tbd.length} game(s) with teams still to be decided (placeholder tip-offs): ${[...new Set(tbd)].join(', ')}.`);
}
if (early.length) console.log(`Earliest tip-off: ${hhmm(Math.min(...early))} UTC`);
if (late.length) console.log(`Latest tip-off:   ${hhmm(Math.max(...late))} UTC (needs runs until ~${hhmm(Math.max(...late) + NEEDS_RUNS_FOR_H * 60)} UTC)`);

const caught = games.filter(({ g }) => overlaps(minutesOfDay(new Date(g.gameDateTimeUTC!)), NEEDS_RUNS_FOR_H * 60));
console.log(`\nWindow ${hhmm(startH * 60)}–${hhmm(endH * 60)} UTC: ${caught.length === 0 ? 'SAFE, no game needs runs during it.' : `${caught.length} game(s) need runs during it:`}`);
for (const { date, g } of caught) {
  console.log(`  ${date}  ${g.awayTeam.teamTricode}@${g.homeTeam.teamTricode}  tip-off ${g.gameDateTimeUTC}`);
}
