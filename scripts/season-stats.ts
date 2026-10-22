// scripts/season-stats.ts
// A whole season through the algorithm, to calibrate the settings on real data.
// Local only: the output says a lot about the settings (the logs of a public repo are public).
//
// Usage:
//   npm run season-stats -- 2025-26            → downloads what's missing, then the report
//   npm run season-stats -- 2025-26 --offline  → only what's already downloaded
//   npm run season-stats -- 2025-26 --clutch   → also the play-by-play (once, 10–15 min), and a comparison:
//                                                suspense from the final margin vs from the clutch time
//
// The box scores are kept in .cache/ (ignored by Git), reduced to what the algorithm reads:
// the first run takes 10 to 15 minutes, the next ones a second. Change scoring.secret.json,
// run again, compare.

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchBoxscore, fetchPlayByPlay, pause } from './nba/client.ts';
import { computeClutch, swings, toTimeline, weightedSwings, SWING_WEIGHTS, type RawPlayByPlay, type Timeline } from './nba/clutch.ts';
import { CLUTCH_CLOSE_MARGIN_AT_2, CLUTCH_CLOSE_SECONDS, closeByClutch, rawWithClutch, type Pbp } from './nba/clutch-rating.ts';
import { isFinal, toGame } from './nba/adapter.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import {
  competitivenessDetails, competitivenessPoints, disputedBaseFor, displayScore, efficiency, finalScore,
  isDisputed, loserBiggestLead, marginAfterQ3, performancePoints, playerPoints, rawScore, regulationMargin,
} from '../src/lib/scoring.ts';
import type { Game } from '../src/types/game.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
type CachedGame = Game & { id: string; date?: string };

// Regular season IDs: '002' + the season's first year on 2 digits + a 5-digit number.
// 82 games × 30 teams / 2 = 1,230 games.
const GAMES_PER_SEASON = 1230;
const seasonIds = (season: string) => {
  const yy = season.slice(2, 4);
  return Array.from({ length: GAMES_PER_SEASON }, (_, i) => `002${yy}${String(i + 1).padStart(5, '0')}`);
};

async function download(season: string, dir: string): Promise<void> {
  const ids = seasonIds(season).filter((id) => !existsSync(path.join(dir, `${id}.json`)));
  if (ids.length === 0) return;
  console.log(`Downloading ${ids.length} box score(s), one every ~0.5 s…`);
  let failures = 0;
  let done = 0;
  for (const id of ids) {
    try {
      const box = await fetchBoxscore(id);
      if (isFinal(box)) {
        const game: CachedGame = { id, ...(box.game.gameTimeUTC ? { date: box.game.gameTimeUTC.slice(0, 10) } : {}), ...toGame(box) };
        await writeFile(path.join(dir, `${id}.json`), JSON.stringify(game));
      }
      failures = 0;
    } catch (error) {
      failures++;
      console.warn(`  ${id}: ${error instanceof Error ? error.message : error}`);
      // Many failures in a row: blocked, or the end of the season. Stop, the cache keeps what's done.
      if (failures >= 15) {
        console.warn('15 failures in a row: stopping. Run again later; what is downloaded is kept.');
        return;
      }
    }
    if (++done % 100 === 0) console.log(`  ${done} / ${ids.length}`);
    await pause(400);
  }
}

// --- Report ---------------------------------------------------------------------------

const pct = (part: number, total: number) => (total ? `${((100 * part) / total).toFixed(1)}%` : '-');
const label = (g: CachedGame) => `${g.date ?? g.id} ${g.away}@${g.home}`;
const n1 = (x: number) => x.toFixed(1);

function title(text: string): void {
  console.log(`\n=== ${text} ${'='.repeat(Math.max(0, 70 - text.length))}`);
}

function report(games: CachedGame[]): void {
  const s = SCORING;
  const c = s.disputed;
  const n = games.length;
  // About 165 nights in a regular season: "per night" makes frequencies easy to picture
  const nights = new Set(games.map((g) => g.date).filter(Boolean)).size || 165;
  console.log(`\n${n} games, ${nights} nights.`);

  // 1. Ratings
  title('Ratings');
  const notes = games.map(displayScore);
  const buckets = [[0, 19], [20, 34], [35, 49], [50, 59], [60, 69], [70, 79], [80, 89], [90, 99], [100, 100]];
  for (const [lo, hi] of buckets) {
    const k = notes.filter((x) => x >= lo! && x <= hi!).length;
    console.log(`  ${`${lo}–${hi}`.padEnd(8)} ${String(k).padStart(5)}  ${pct(k, n).padStart(6)}  ${'█'.repeat(Math.round((60 * k) / n))}`);
  }
  const fifty = notes.filter((x) => x >= 50).length;
  const hundreds = notes.filter((x) => x === 100).length;
  console.log(`  50 or more: ${pct(fifty, n)} of games. 100s: ${hundreds} (one every ${n1(nights / Math.max(1, hundreds))} nights).`);

  // 2. Individual performances
  title('Individual performances (efficiency)');
  const lines = games.flatMap((g) => g.players.map((p) => ({ g, p, eff: efficiency(p) })));
  for (const t of [30, 35, 40, 45, 50, 55, 60]) {
    const k = lines.filter((x) => x.eff >= t).length;
    console.log(`  ≥ ${t}: ${String(k).padStart(5)} player-games  ≈ ${n1(k / nights).padStart(5)} per night  ${k ? `(one every ${n1(n / k)} games)` : ''}`);
  }
  console.log(`  Points with the current settings (threshold ${s.performance.threshold}, ÷ ${s.performance.divisor}):`);
  console.log(`    ${[35, 38, 40, 45, 50, 55, 60].map((e) => `${e} → ${n1(Math.max(0, e - s.performance.threshold) ** 2 / s.performance.divisor)}`).join('   ')}`);
  console.log('  Top 15:');
  for (const { g, p, eff } of [...lines].sort((a, b) => b.eff - a.eff).slice(0, 15)) {
    const team = p.team === 'home' ? g.home : g.away;
    console.log(`    ${String(eff).padStart(3)}  ${(p.name ?? '?').padEnd(24)} ${team}  ${p.pts} pts ${p.reb} reb ${p.ast} ast  ${label(g).padEnd(22)} → ${displayScore(g)}`);
  }

  // 3. Saturated ingredients, among close games
  const close = games.filter((g) => regulationMargin(g) <= c.maxRegulationMargin
    || marginAfterQ3(g) <= c.maxMarginAfterQ3 || loserBiggestLead(g) >= c.minLoserBiggestLead);
  title(`Ingredients at their maximum (${close.length} close games)`);
  for (const key of ['suspense', 'scenario', 'comeback', 'offense'] as const) {
    const k = close.filter((g) => competitivenessDetails(g)[key].share >= 1).length;
    console.log(`  ${key.padEnd(9)} ${pct(k, close.length).padStart(6)} at 100%`);
  }
  const leads = close.map(loserBiggestLead).sort((a, b) => a - b);
  const q = (f: number) => leads[Math.min(leads.length - 1, Math.floor(f * leads.length))] ?? 0;
  console.log(`  Loser's biggest lead: median ${q(0.5)}, 75th pct ${q(0.75)}, 90th pct ${q(0.9)}, max ${q(1)}  (comeback full at ${s.comeback.fullAt})`);
  const twists = close.map((g) => g.leadChanges + g.timesTied).sort((a, b) => a - b);
  const qt = (f: number) => twists[Math.min(twists.length - 1, Math.floor(f * twists.length))] ?? 0;
  console.log(`  Lead changes + ties:  median ${qt(0.5)}, 75th pct ${qt(0.75)}, 90th pct ${qt(0.9)}, max ${qt(1)}  (scenario full at ${s.scenario.fullAt})`);

  // 4. The margin-after-Q3 test
  title('Margin after Q3: games close ONLY thanks to this test');
  const onlyQ3 = (g: Game, t: number) => regulationMargin(g) > c.maxRegulationMargin
    && loserBiggestLead(g) < c.minLoserBiggestLead && marginAfterQ3(g) <= t;
  for (const t of [3, 4, 5, 6, 7, 8, 10, 12]) {
    const k = games.filter((g) => onlyQ3(g, t)).length;
    console.log(`  threshold ${String(t).padStart(2)}${t === c.maxMarginAfterQ3 ? ' (current)' : '          '}  ${String(k).padStart(4)} games  ${pct(k, n).padStart(6)}`);
  }
  const current = games.filter((g) => onlyQ3(g, c.maxMarginAfterQ3));
  if (current.length > 0) {
    console.log('  With the current threshold (final margin, margin after Q3, rating):');
    for (const g of current.slice(0, 25)) {
      const f = finalScore(g);
      console.log(`    ${label(g).padEnd(22)} final ${String(Math.abs(f.home - f.away)).padStart(2)}  after Q3 ${String(marginAfterQ3(g)).padStart(2)}  → ${displayScore(g)}`);
    }
  }

  // 5. Best games of the season
  title('Top 10 games');
  for (const g of [...games].sort((a, b) => rawScore(b) - rawScore(a)).slice(0, 10)) {
    const best = [...g.players].sort((a, b) => playerPoints(b) - playerPoints(a))[0];
    console.log(`  ${n1(rawScore(g)).padStart(6)}  ${label(g).padEnd(22)} margin ${regulationMargin(g)}  best eff ${best ? efficiency(best) : '-'}`);
  }
}

// --- Clutch (play-by-play) --------------------------------------------------------------

async function downloadPlayByPlay(ids: string[], dir: string): Promise<void> {
  const missing = ids.filter((id) => !existsSync(path.join(dir, `${id}.json`)));
  if (missing.length === 0) return;
  console.log(`Downloading ${missing.length} play-by-play file(s), one every ~0.5 s…`);
  let failures = 0, done = 0;
  for (const id of missing) {
    try {
      const raw = await fetchPlayByPlay(id);
      // Only the score timeline is kept. An unexpected format stops everything at the first game,
      // with what was found, rather than producing wrong numbers.
      let timeline: Timeline;
      try {
        timeline = toTimeline(raw as RawPlayByPlay);
      } catch (error) {
        const game = (raw as { game?: Record<string, unknown> })?.game;
        console.error(`Play-by-play format not as expected (${error instanceof Error ? error.message : error}).`);
        console.error('Keys of "game":', game ? Object.keys(game).join(', ') : '(no "game")');
        const actions = game?.actions as unknown[] | undefined;
        if (Array.isArray(actions)) console.error('First action:', JSON.stringify(actions[1] ?? actions[0]).slice(0, 600));
        throw new Error('Stopped: paste this message to fix the format.');
      }
      await writeFile(path.join(dir, `${id}.json`), JSON.stringify(timeline));
      failures = 0;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Stopped')) throw error;
      failures++;
      console.warn(`  ${id}: ${error instanceof Error ? error.message : error}`);
      if (failures >= 15) {
        console.warn('15 failures in a row: stopping. Run again later; what is downloaded is kept.');
        return;
      }
    }
    if (++done % 100 === 0) console.log(`  ${done} / ${missing.length}`);
    await pause(400);
  }
}

function clutchReport(games: CachedGame[], pbp: Map<string, Pbp>): void {
  const withPbp = games.filter((g) => pbp.has(g.id));
  title(`Clutch vs final margin (${withPbp.length} games with play-by-play)`);
  if (withPbp.length === 0) return;

  // Check: lead changes + ties recounted from the play-by-play vs the box score's totals
  const diffs = withPbp.map((g) => pbp.get(g.id)!.count - (g.leadChanges + g.timesTied));
  const exact = diffs.filter((d) => d === 0).length;
  const off1 = diffs.filter((d) => Math.abs(d) === 1).length;
  console.log(`  Check, lead changes + ties from the play-by-play vs the box score: ${pct(exact, diffs.length)} identical, ${pct(off1, diffs.length)} off by 1, ${pct(diffs.length - exact - off1, diffs.length)} more.`);

  // C: the weighted scenario's "full at", so that the same share of close games is at the max as today
  const closeGames = withPbp.filter((g) => isDisputed(g));
  const todayAtMax = closeGames.filter((g) => competitivenessDetails(g).scenario.share >= 1).length / closeGames.length;
  const weightedClose = closeGames.map((g) => pbp.get(g.id)!.weighted).sort((x, y) => x - y);
  const scenarioFullAt = weightedClose[Math.min(weightedClose.length - 1, Math.floor((1 - todayAtMax) * weightedClose.length))] || 1;
  const wq = (f: number) => weightedClose[Math.min(weightedClose.length - 1, Math.floor(f * weightedClose.length))];
  console.log(`  C — weighted swings (Q1 ×${SWING_WEIGHTS.q1}, Q2 ×${SWING_WEIGHTS.q2}, Q3 ×${SWING_WEIGHTS.q3}, Q4 ×${SWING_WEIGHTS.q4}, last 5 min / OT ×${SWING_WEIGHTS.late}):`);
  console.log(`      close games: median ${wq(0.5)}, 75th pct ${wq(0.75)}, 90th pct ${wq(0.9)}, max ${wq(1)}. Full at ${scenarioFullAt} (${pct(todayAtMax * closeGames.length, closeGames.length)} at the max, as today).`);

  const rows = withPbp.map((g) => {
    const x = pbp.get(g.id)!;
    const c = x.clutch;
    const f = finalScore(g);
    return {
      g, c, x, final: Math.abs(f.home - f.away),
      now: displayScore(g),
      a: Math.min(100, Math.round(rawWithClutch(g, x, 'A'))),
      b: Math.min(100, Math.round(rawWithClutch(g, x, 'B'))),
      cc: Math.min(100, Math.round(rawWithClutch(g, x, 'C', scenarioFullAt))),
    };
  });

  const close = rows.filter((r) => isDisputed(r.g));
  const buckets: [string, (s: number) => boolean][] = [
    ['none', (s) => s === 0], ['1–60 s', (s) => s > 0 && s <= 60], ['61–180 s', (s) => s > 60 && s <= 180],
    ['181–299 s', (s) => s > 180 && s < 300], ['5 min or more', (s) => s >= 300],
  ];
  console.log(`  Clutch time in close games (${close.length}):`);
  for (const [name, test] of buckets) {
    const k = close.filter((r) => test(r.c.seconds)).length;
    console.log(`    ${name.padEnd(14)} ${String(k).padStart(4)}  ${pct(k, close.length).padStart(6)}`);
  }

  // Step 1 with the clutch: the blowouts that become close games
  const rescued = rows.filter((r) => !isDisputed(r.g) && closeByClutch(r.c));
  const bySeconds = rescued.filter((r) => r.c.seconds >= CLUTCH_CLOSE_SECONDS).length;
  const byMargin = rescued.filter((r) => r.c.marginAt2 <= CLUTCH_CLOSE_MARGIN_AT_2).length;
  console.log(`  B — blowouts today that become close games: ${rescued.length} (${pct(rescued.length, rows.length)} of all games)`);
  console.log(`      with ≥ ${CLUTCH_CLOSE_SECONDS} s of clutch: ${bySeconds}, within ${CLUTCH_CLOSE_MARGIN_AT_2} at 2:00: ${byMargin}`);

  console.log('  Ratings: now → A (suspense from clutch) → B (A + clutch in step 1) → C (B + weighted scenario):');
  type Key = 'now' | 'a' | 'b' | 'cc';
  const keys: Key[] = ['now', 'a', 'b', 'cc'];
  const ranges = [[0, 19], [20, 34], [35, 49], [50, 59], [60, 69], [70, 79], [80, 89], [90, 99], [100, 100]];
  const share = (key: Key, lo: number, hi: number) => pct(rows.filter((r) => r[key] >= lo && r[key] <= hi).length, rows.length).padStart(6);
  for (const [lo, hi] of ranges) {
    console.log(`    ${`${lo}–${hi}`.padEnd(8)} ${keys.map((k) => share(k, lo!, hi!)).join(' → ')}`);
  }
  const count = (key: Key, test: (x: number) => boolean) => rows.filter((r) => test(r[key])).length;
  console.log(`    50 or more: ${keys.map((k) => pct(count(k, (x) => x >= 50), rows.length)).join(' → ')}`);
  console.log(`    100s: ${keys.map((k) => count(k, (x) => x === 100)).join(' → ')}`);

  const line = (r: (typeof rows)[number]) =>
    `    ${label(r.g).padEnd(22)} final ${String(r.final).padStart(2)}  at 2:00 ${String(r.c.marginAt2).padStart(2)}  clutch ${String(r.c.seconds).padStart(3)} s  swings ${String(r.x.count).padStart(2)} (w ${String(r.x.weighted).padStart(5)})  late ${r.c.lateChanges}  ${keys.map((k) => String(r[k]).padStart(3)).join(' → ')}`;
  console.log('  Blowouts that become close games with B:');
  rows.filter((r) => !isDisputed(r.g) && closeByClutch(r.c)).forEach((r) => console.log(line(r)));
  console.log('  Biggest drops (close final margin, but no real clutch):');
  [...rows].sort((x, y) => (x.b - x.now) - (y.b - y.now)).slice(0, 10).forEach((r) => console.log(line(r)));
  console.log('  C vs B — weighted scenario, biggest gains (late swings):');
  [...rows].sort((x, y) => (y.cc - y.b) - (x.cc - x.b)).slice(0, 10).forEach((r) => console.log(line(r)));
  console.log('  C vs B — weighted scenario, biggest drops (early swings):');
  [...rows].sort((x, y) => (x.cc - x.b) - (y.cc - y.b)).slice(0, 10).forEach((r) => console.log(line(r)));
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('season-stats prints the details of the settings: never on GitHub Actions (public logs).');
  }
  const args = process.argv.slice(2);
  const season = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  if (!season) throw new Error('Usage: npm run season-stats -- 2025-26 [--offline] [--clutch]');
  loadScoring();

  const dir = path.join(ROOT, '.cache', 'boxscores', season);
  await mkdir(dir, { recursive: true });
  if (!args.includes('--offline')) await download(season, dir);

  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  const games = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8')) as CachedGame));
  if (games.length === 0) throw new Error(`No box score in ${dir}.`);
  report(games.sort((a, b) => a.id.localeCompare(b.id)));

  if (args.includes('--clutch')) {
    const pbpDir = path.join(ROOT, '.cache', 'playbyplay', season);
    await mkdir(pbpDir, { recursive: true });
    if (!args.includes('--offline')) await downloadPlayByPlay(games.map((g) => g.id), pbpDir);
    const pbp = new Map<string, Pbp>();
    for (const g of games) {
      const file = path.join(pbpDir, `${g.id}.json`);
      if (!existsSync(file)) continue;
      const timeline = JSON.parse(await readFile(file, 'utf8')) as Timeline;
      pbp.set(g.id, { clutch: computeClutch(timeline, g.periods.length), weighted: weightedSwings(timeline), count: swings(timeline).length });
    }
    clutchReport(games, pbp);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
