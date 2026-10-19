// scripts/fetch-night.ts
// The server script, run every 15 minutes by GitHub Actions:
//   1. decides which nights need work (scripts/nba/plan.ts) — most runs stop here;
//   2. puts the night on the site at its first tip-off, every game without a rating;
//   3. rates each game as soon as it's over (box score from nba.com → algorithm);
//   4. writes public/data/YYYY-MM-DD.json and public/data/latest.json, WITHOUT any score,
//      only when something changed.
//
// Usage:
//   npm run fetch                      → whatever the current time calls for
//   npm run fetch -- --date=2026-10-20 → a specific date
//   npm run fetch:fixture              → the real games of April 4, 2026, no network

import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchBoxscore, fetchSchedule, pause } from './nba/client.ts';
import { gamesOnDate, isFinal, toGame } from './nba/adapter.ts';
import { orderGames, type Entry } from './nba/order.ts';
import { planRun, type Published } from './nba/plan.ts';
import {
  competitivenessPoints, displayScore, isDisputed, performancePoints, rawScore,
} from '../src/lib/scoring.ts';
import { useScoring } from '../src/config/scoring.ts';
import type { Game } from '../src/types/game.ts';
import type { RawSchedule } from './nba/types.ts';
import { nightIsComplete, type NightJson } from '../src/types/public.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const round1 = (x: number) => Math.round(x * 10) / 10;
const fileFor = (date: string) => path.join(OUT_DIR, `${date}.json`);

async function readNight(file: string): Promise<NightJson | null> {
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8')) as NightJson;
}

function publishedState(date: string): Published {
  const file = fileFor(date);
  if (!existsSync(file)) return 'none';
  // Synchronous read: planRun is a plain function, and these files are tiny.
  const night = JSON.parse(readFileSync(file, 'utf8')) as NightJson;
  return nightIsComplete(night) ? 'complete' : 'partial';
}

function logRated(game: Game): void {
  // Developer-only details: never published
  console.log(
    `  ${`${game.away}@${game.home}`.padEnd(8)}`,
    isDisputed(game) ? 'close  ' : 'blowout',
    `compet. ${competitivenessPoints(game).toFixed(1).padStart(5)}`,
    `perfs ${performancePoints(game).toFixed(1).padStart(5)}`,
    `raw ${rawScore(game).toFixed(1).padStart(6)}`,
    `→ ${displayScore(game)}`,
  );
}

// One night: keeps the ratings already published, rates the games that just ended.
async function updateNight(schedule: RawSchedule, date: string, now: number): Promise<NightJson> {
  const previous = (await readNight(fileFor(date)))?.games ?? [];
  const alreadyRated = new Map(
    previous.filter((g) => g.note !== undefined).map((g) => [`${g.away}@${g.home}`, g]),
  );

  // A game that hasn't started is only treated as postponed once the night is surely over
  // (from 06:00 UTC the next day). Before that, it simply hasn't been played yet.
  const nightIsOver = now > Date.parse(`${date}T00:00:00Z`) + 30 * 60 * 60 * 1000;

  const scheduled = gamesOnDate(schedule, date);
  console.log(`${date}: ${scheduled.length} game(s)`);

  const entries: Entry[] = [];
  for (const g of scheduled) {
    const away = g.awayTeam.teamTricode;
    const home = g.homeTeam.teamTricode;
    const label = `${away}@${home}`;
    const base = { away, home, ...(g.gameDateTimeUTC ? { tipOff: g.gameDateTimeUTC } : {}) };

    const rated = alreadyRated.get(label);
    if (rated) {
      entries.push({ ...base, note: rated.note, ...(rated.raw !== undefined ? { raw: rated.raw } : {}) });
      continue;
    }
    if (base.tipOff && Date.parse(base.tipOff) > now) {
      entries.push(base); // not started yet: no NBA call needed
      continue;
    }

    let box;
    try {
      box = await fetchBoxscore(g.gameId);
    } catch (error) {
      if (g.gameStatus !== 1) throw error;
      box = null; // no box score yet: the game hasn't started
    }
    await pause(500);

    const started = box !== null && !(box.game.gameStatus === 1 && g.gameStatus === 1);
    if (!started) {
      if (nightIsOver) {
        console.warn(`${label}: never started (postponed?), skipped.`);
        continue;
      }
      entries.push(base);
      continue;
    }

    // Zero spoilers: never a partial rating. A game only gets one once it's over.
    if (!isFinal(box!)) {
      console.log(`${label}: in progress.`);
      entries.push(base);
      continue;
    }
    const game = toGame(box!);
    logRated(game);
    entries.push({ ...base, note: displayScore(game), raw: round1(rawScore(game)) });
  }

  return { version: 2, date, games: orderGames(previous, entries) };
}

async function fixtureNight(): Promise<NightJson> {
  const [{ sasAtDen }, { wasAtMia }, { detAtPhi }] = await Promise.all([
    import('../fixtures/2026-04-04-sas-den.ts'),
    import('../fixtures/2026-04-04-was-mia.ts'),
    import('../fixtures/2026-04-04-det-phi.ts'),
  ]);
  const games = [sasAtDen, wasAtMia, detAtPhi];
  games.forEach(logRated);
  const entries = games.map((g) => ({ away: g.away, home: g.home, note: displayScore(g), raw: round1(rawScore(g)) }));
  return { version: 2, date: '2026-04-04', games: orderGames([], entries) };
}

// Writes the night if it changed. latest.json only ever moves forward: catching up on an
// older night (or a manual --date) must not replace a more recent one.
async function save(night: NightJson, { forceLatest = false } = {}): Promise<void> {
  const json = JSON.stringify(night, null, 2) + '\n';
  await mkdir(OUT_DIR, { recursive: true });

  const file = fileFor(night.date);
  const before = existsSync(file) ? await readFile(file, 'utf8') : null;
  if (before !== json) {
    await writeFile(file, json);
    console.log(`Written: public/data/${night.date}.json`);
  } else {
    console.log(`${night.date}: no change.`);
  }

  const latestPath = path.join(OUT_DIR, 'latest.json');
  const latest = await readNight(latestPath);
  if (forceLatest || !latest || night.date >= latest.date) {
    if ((existsSync(latestPath) ? await readFile(latestPath, 'utf8') : null) !== json) {
      await writeFile(latestPath, json);
      console.log('Written: public/data/latest.json');
    }
  }
}

// The real settings of the algorithm are not in the repo (see src/config/scoring.ts):
// the SCORING_CONFIG secret on GitHub Actions, or scoring.secret.json locally.
function loadScoring(): void {
  const fromEnv = process.env.SCORING_CONFIG;
  if (fromEnv) {
    useScoring(JSON.parse(fromEnv), 'SCORING_CONFIG secret');
    console.log('Scoring: real settings (SCORING_CONFIG).');
    return;
  }
  const localFile = path.join(ROOT, 'scoring.secret.json');
  if (existsSync(localFile)) {
    useScoring(JSON.parse(readFileSync(localFile, 'utf8')), 'scoring.secret.json');
    console.log('Scoring: real settings (scoring.secret.json).');
    return;
  }
  // On GitHub, never publish ratings computed with the example values
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('The SCORING_CONFIG secret is missing: nothing published.');
  }
  console.warn('Scoring: EXAMPLE settings (no SCORING_CONFIG, no scoring.secret.json). Ratings are not the real ones.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const useFixture = args.includes('--fixture');
  loadScoring();
  const dateArg = args.find((a) => a.startsWith('--date='))?.slice('--date='.length);
  if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) throw new Error(`Invalid date: ${dateArg}`);

  if (useFixture) {
    await save(await fixtureNight(), { forceLatest: true });
    return;
  }

  console.log('NBA schedule…');
  const schedule = await fetchSchedule();
  const now = new Date();

  let dates: string[];
  if (dateArg) {
    dates = [dateArg]; // an explicit date always runs
  } else {
    const plan = planRun(
      now,
      (d) => gamesOnDate(schedule, d).map((g) => ({ tipOff: g.gameDateTimeUTC })),
      publishedState,
    );
    if (plan.action === 'idle') {
      console.log(`Nothing to do: ${plan.reason}.`);
      return;
    }
    dates = plan.dates;
  }

  for (const date of dates) {
    await save(await updateNight(schedule, date, now.getTime()));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
