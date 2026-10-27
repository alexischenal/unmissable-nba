// scripts/nba/plan.ts
// Decides what a scheduled run should do. Pure functions: no network, no files, easy to test.
//
// The workflow wakes up every 5 minutes (cron-job.org), except between 08:00 and 15:00 UTC, when no game
// is under way (checked by npm run check-window). A night appears on the site at its first
// tip-off (until then, the site keeps the previous night), then each game gets its rating as
// soon as it's over. Most runs have nothing to do and stop right away.

// A "night" is a US date (New York time). It starts at 06:00 in New York: before that,
// we're still in the previous night (late West Coast games, overtimes).
const NIGHT_STARTS_AT_HOUR_NY = 6;

export type NightGame = {
  tipOff: string | undefined; // ISO time in UTC, from the schedule (may be missing)
};

// What's already on the site for a date: nothing, some games still unrated, or every game rated.
export type Published = 'none' | 'partial' | 'complete';

export type RunPlan =
  | { action: 'idle'; reason: string } // nothing to do, stop quietly
  | { action: 'process'; dates: string[] }; // check the box scores of these nights, oldest first

// The current night's US date: the New York date, 6 hours ago.
export function currentNight(now: Date): string {
  const shifted = new Date(now.getTime() - NIGHT_STARTS_AT_HOUR_NY * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(shifted);
}

function shiftDay(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const previousDay = (isoDate: string) => shiftDay(isoDate, -1);
export const nextDay = (isoDate: string) => shiftDay(isoDate, 1);

export function planRun(
  now: Date,
  gamesOn: (date: string) => NightGame[],
  published: (date: string) => Published,
): RunPlan {
  const tonight = currentNight(now);
  const dates: string[] = [];
  const waiting: string[] = [];

  // The previous night too: if it's still incomplete (NBA data late, a run that failed),
  // it gets another chance instead of being left half-rated forever.
  for (const date of [previousDay(tonight), tonight]) {
    const state = published(date);
    if (state === 'complete') continue;

    const games = gamesOn(date);
    // No games: nothing to publish. The site keeps showing the last published night.
    if (games.length === 0) continue;

    // Not on the site yet and no game has tipped off: keep showing the previous night.
    const firstTipOff = Math.min(...games.map((g) => (g.tipOff ? Date.parse(g.tipOff) : 0)));
    if (state === 'none' && firstTipOff > now.getTime()) {
      waiting.push(date);
      continue;
    }
    dates.push(date);
  }

  if (dates.length > 0) return { action: 'process', dates };
  return {
    action: 'idle',
    reason: waiting.length > 0
      ? `first tip-off of ${waiting.join(', ')} not reached yet`
      : `nothing left to publish (current night: ${tonight})`,
  };
}
