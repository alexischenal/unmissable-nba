// scripts/fetch-night.ts
// The server script, run every 15 minutes by GitHub Actions:
//   1. decides whether there is a night to publish (scripts/nba/plan.ts) — most runs stop here;
//   2. fetches the night's games from nba.com and computes the ratings;
//   3. writes public/data/YYYY-MM-DD.json and public/data/latest.json, WITHOUT any score.
//
// Usage:
//   npm run fetch                      → whatever the current time calls for
//   npm run fetch -- --date=2026-10-20 → a specific date
//   npm run fetch:fixture              → the real games of April 4, 2026, no network

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchBoxscore, fetchSchedule, pause } from './nba/client.ts';
import { gamesOnDate, isFinal, toGame } from './nba/adapter.ts';
import { planRun } from './nba/plan.ts';
import {
  competitivenessPoints, displayScore, isDisputed, performancePoints, rawScore,
} from '../src/lib/scoring.ts';
import type { Game } from '../src/types/game.ts';
import type { RawSchedule } from './nba/types.ts';
import type { NightJson } from '../src/types/public.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');

class NotFinishedError extends Error {}

async function gamesFromNba(schedule: RawSchedule, date: string): Promise<Game[]> {
  const scheduled = gamesOnDate(schedule, date);
  console.log(`${scheduled.length} game(s) on ${date}`);

  // A game that hasn't started is only treated as postponed once the night is surely over
  // (from 06:00 UTC the next day). Before that, it simply hasn't been played yet.
  const nightIsOver = Date.now() > Date.parse(`${date}T00:00:00Z`) + 30 * 60 * 60 * 1000;

  const games: Game[] = [];
  for (const entry of scheduled) {
    const label = `${entry.awayTeam.teamTricode}@${entry.homeTeam.teamTricode}`;
    console.log(`Box score ${label} (${entry.gameId})…`);

    let box;
    try {
      box = await fetchBoxscore(entry.gameId);
    } catch (error) {
      if (entry.gameStatus === 1) {
        if (!nightIsOver) throw new NotFinishedError(`${label} hasn't started yet: nothing published.`);
        console.warn(`${label}: no box score and never started (postponed?), skipped.`);
        continue;
      }
      throw error;
    }
    if (box.game.gameStatus === 1 && entry.gameStatus === 1) {
      if (!nightIsOver) throw new NotFinishedError(`${label} hasn't started yet: nothing published.`);
      console.warn(`${label}: never started (postponed?), skipped.`);
      continue;
    }

    // Zero spoilers: never a partial rating. If a game isn't over, nothing is published.
    if (!isFinal(box)) {
      throw new NotFinishedError(`${label} isn't over: nothing published, run again later.`);
    }
    games.push(toGame(box));
    await pause(500);
  }
  return games;
}

async function gamesFromFixtures(): Promise<Game[]> {
  const [{ sasAtDen }, { wasAtMia }, { detAtPhi }] = await Promise.all([
    import('../fixtures/2026-04-04-sas-den.ts'),
    import('../fixtures/2026-04-04-was-mia.ts'),
    import('../fixtures/2026-04-04-det-phi.ts'),
  ]);
  return [sasAtDen, wasAtMia, detAtPhi];
}

function buildPublicJson(date: string, games: Game[]): NightJson {
  return {
    version: 1,
    date,
    games: [...games]
      .sort((a, b) => rawScore(b) - rawScore(a)) // ranked on the raw rating (can exceed 100)
      .map((g) => ({ away: g.away, home: g.home, note: displayScore(g) })),
  };
}

function logDetails(games: Game[]): void {
  // Developer-only details: never published
  for (const g of [...games].sort((a, b) => rawScore(b) - rawScore(a))) {
    console.log(
      `  ${`${g.away}@${g.home}`.padEnd(8)}`,
      isDisputed(g) ? 'close  ' : 'blowout',
      `compet. ${competitivenessPoints(g).toFixed(1).padStart(5)}`,
      `perfs ${performancePoints(g).toFixed(1).padStart(5)}`,
      `raw ${rawScore(g).toFixed(1).padStart(6)}`,
      `→ ${displayScore(g)}`,
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const useFixture = args.includes('--fixture');
  const dateArg = args.find((a) => a.startsWith('--date='))?.slice('--date='.length);
  if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) throw new Error(`Invalid date: ${dateArg}`);

  const published = (date: string) => existsSync(path.join(OUT_DIR, `${date}.json`));

  let date: string;
  let games: Game[];
  if (useFixture) {
    date = '2026-04-04';
    games = await gamesFromFixtures();
  } else {
    console.log('NBA schedule…');
    const schedule = await fetchSchedule();
    if (dateArg) {
      date = dateArg; // an explicit date always runs
    } else {
      const plan = planRun(
        new Date(),
        (d) => gamesOnDate(schedule, d).map((g) => ({ tipOff: g.gameDateTimeUTC })),
        published,
      );
      if (plan.action !== 'process') {
        console.log(`Nothing to do: ${plan.reason}.`);
        return;
      }
      date = plan.date;
    }
    games = await gamesFromNba(schedule, date);
  }

  logDetails(games);

  const json = JSON.stringify(buildPublicJson(date, games), null, 2) + '\n';
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, `${date}.json`), json);
  console.log(`\nWritten: public/data/${date}.json`);

  // latest.json only ever moves forward: catching up on an older night (or a manual --date)
  // must not replace a more recent one.
  const latestPath = path.join(OUT_DIR, 'latest.json');
  const latestDate = existsSync(latestPath)
    ? ((JSON.parse(await readFile(latestPath, 'utf8')) as Partial<NightJson>).date ?? '')
    : '';
  if (useFixture || date >= latestDate) {
    await writeFile(latestPath, json);
    console.log('Written: public/data/latest.json');
  }
}

main().catch((error: unknown) => {
  if (error instanceof NotFinishedError) {
    console.warn(error.message);
    process.exit(2);
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
