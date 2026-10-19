// scripts/nba/plan.ts
// Decides what a scheduled run should do. Pure function: no network, no files, easy to test.
//
// The workflow wakes up every 15 minutes, all day. Most runs have nothing to do and stop
// right away; the real work only happens between the last tip-off of a night and its end.

// A "night" is a US date (New York time). It starts at 06:00 in New York: before that,
// we're still in the previous night (late West Coast games, overtimes).
const NIGHT_STARTS_AT_HOUR_NY = 6;

export type NightGame = {
  tipOff: string | undefined; // ISO time in UTC, from the schedule (may be missing)
};

export type RunPlan =
  | { action: 'idle'; reason: string } // nothing to do, stop quietly
  | { action: 'wait'; date: string; reason: string } // a night is under way, come back later
  | { action: 'process'; date: string }; // fetch the box scores of this night

// The current night's US date: the New York date, 6 hours ago.
export function currentNight(now: Date): string {
  const shifted = new Date(now.getTime() - NIGHT_STARTS_AT_HOUR_NY * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(shifted);
}

export function previousDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function planRun(
  now: Date,
  gamesOn: (date: string) => NightGame[],
  isPublished: (date: string) => boolean,
): RunPlan {
  const tonight = currentNight(now);

  // The previous night first: if it was never published (NBA data late, a run that failed),
  // it gets another chance instead of being skipped forever.
  for (const date of [previousDay(tonight), tonight]) {
    if (isPublished(date)) continue;

    const games = gamesOn(date);
    // No games: nothing to publish. The site keeps showing the last published night.
    if (games.length === 0) continue;

    // As long as one game hasn't tipped off, the night can't be over: no need to call the NBA.
    const lastTipOff = Math.max(...games.map((g) => (g.tipOff ? Date.parse(g.tipOff) : 0)));
    if (lastTipOff > now.getTime()) {
      return { action: 'wait', date, reason: `last tip-off of ${date} not reached yet` };
    }
    return { action: 'process', date };
  }

  return { action: 'idle', reason: `nothing left to publish (current night: ${tonight})` };
}
