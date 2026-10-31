// scripts/season-stats.ts
// A whole season through the algorithm, to calibrate the settings on real data.
// Local only: the output says a lot about the settings (the logs of a public repo are public).
//
// Usage:
//   npm run season-stats -- 2025-26            → downloads what's missing, then the report
//   npm run season-stats -- 2025-26 --offline  → only what's already downloaded
//   npm run season-stats -- 2025-26 --clutch   → also the play-by-play (once, 10–15 min), the
//                                                comparison v1 (box score) vs v2 (with the play-by-play),
//                                                the "?" on the cards (how often, and why),
//                                                and .cache/ratings-2025-26.csv (every game's rating)
//
// The box scores are kept in .cache/ (ignored by Git), reduced to what the algorithm reads:
// the first run takes 10 to 15 minutes, the next ones a second. Change scoring.secret.json,
// run again, compare.

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchBoxscore, fetchPlayByPlay, pause } from './nba/client.ts';
import { computeClutch, lateFrom, swings, timelineMatches, toTimeline, type Clutch, type RawPlayByPlay, type Timeline } from './nba/clutch.ts';
import { isFinal, toGame } from './nba/adapter.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import {
  competitivenessDetails, disputedBaseFor, displayScore, efficiency, finalScore,
  isDisputed, loserBiggestLead, marginAfterQ3, performancePoints, playerPoints, rawScore, regulationMargin,
} from '../src/lib/scoring.ts';
import type { Game } from '../src/types/game.ts';
import { whyOf } from '../src/lib/why.ts';

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
  for (const t of [30, 35, 38, 40, 45, 50, 55, 60]) {
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

type Pbp = { clutch: Clutch; late: NonNullable<Game['late']>; count: number; complete: boolean };

// v1 (box score only) vs v2 (with the play-by-play), both with the settings in use
function clutchReport(games: CachedGame[], pbp: Map<string, Pbp>): void {
  const withPbp = games.filter((g) => pbp.has(g.id));
  title(`v1 vs v2 — clutch and weighted swings (${withPbp.length} games with play-by-play)`);
  if (withPbp.length === 0) return;
  const s = SCORING;

  // Check: lead changes + ties recounted from the play-by-play vs the box score's totals
  const diffs = withPbp.map((g) => pbp.get(g.id)!.count - (g.leadChanges + g.timesTied));
  const exact = diffs.filter((d) => d === 0).length;
  console.log(`  Check, lead changes + ties from the play-by-play vs the box score: ${pct(exact, diffs.length)} identical.`);
  const complete = withPbp.filter((g) => pbp.get(g.id)!.complete).length;
  console.log(`  Check, play-by-play's last score = the box score's final score: ${pct(complete, withPbp.length)} (the site waits for it, then falls back to v1).`);

  const rows = withPbp.map((g) => {
    const x = pbp.get(g.id)!;
    const v2game = { ...g, late: x.late };
    const f = finalScore(g);
    return { g, c: x.clutch, w: x.late.weightedSwings, final: Math.abs(f.home - f.away), v1: displayScore(g), v2: displayScore(v2game), close2: isDisputed(v2game) };
  });

  // Calibration help: weighted swings in close games, and the share at the max with the current "full at"
  const close = rows.filter((r) => r.close2);
  const ws = close.map((r) => r.w).sort((a, b) => a - b);
  const q = (f: number) => ws[Math.min(ws.length - 1, Math.floor(f * ws.length))];
  console.log(`  Weighted swings in close games (Q1 ×${s.swings.q1}, Q2 ×${s.swings.q2}, Q3 ×${s.swings.q3}, Q4 ×${s.swings.q4}, last 5 min / OT ×${s.swings.late}):`);
  console.log(`    median ${q(0.5)}, 75th pct ${q(0.75)}, 90th pct ${q(0.9)}, max ${q(1)} — full at ${s.swings.fullAt}: ${pct(close.filter((r) => r.w >= s.swings.fullAt).length, close.length)} at the max`);
  const buckets: [string, (x: number) => boolean][] = [
    ['none', (x) => x === 0], ['1–60 s', (x) => x > 0 && x <= 60], ['61–180 s', (x) => x > 60 && x <= 180],
    ['181–299 s', (x) => x > 180 && x < 300], ['5 min or more', (x) => x >= 300],
  ];
  console.log(`  Clutch time in close games (${close.length}) — full suspense at ${s.clutch.fullAt} s:`);
  for (const [name, test] of buckets) {
    const k = close.filter((r) => test(r.c.seconds)).length;
    console.log(`    ${name.padEnd(14)} ${String(k).padStart(4)}  ${pct(k, close.length).padStart(6)}`);
  }

  console.log('  Ratings, v1 → v2:');
  const ranges = [[0, 19], [20, 34], [35, 49], [50, 59], [60, 69], [70, 79], [80, 89], [90, 99], [100, 100]];
  const share = (k: 'v1' | 'v2', lo: number, hi: number) => pct(rows.filter((r) => r[k] >= lo && r[k] <= hi).length, rows.length).padStart(6);
  for (const [lo, hi] of ranges) console.log(`    ${`${lo}–${hi}`.padEnd(8)} ${share('v1', lo!, hi!)} → ${share('v2', lo!, hi!)}`);
  const count = (k: 'v1' | 'v2', t: (x: number) => boolean) => rows.filter((r) => t(r[k])).length;
  console.log(`    50 or more: ${pct(count('v1', (x) => x >= 50), rows.length)} → ${pct(count('v2', (x) => x >= 50), rows.length)}`);
  console.log(`    100s: ${count('v1', (x) => x === 100)} → ${count('v2', (x) => x === 100)}`);

  const line = (r: (typeof rows)[number]) =>
    `    ${label(r.g).padEnd(22)} final ${String(r.final).padStart(2)}  at 2:00 ${String(r.c.marginAt2).padStart(2)}  clutch ${String(r.c.seconds).padStart(3)} s  weighted swings ${String(r.w).padStart(5)}  ${String(r.v1).padStart(3)} → ${String(r.v2).padStart(3)}`;
  console.log('  Blowouts in v1 that become close games in v2:');
  rows.filter((r) => !isDisputed(r.g) && r.close2).forEach((r) => console.log(line(r)));
  console.log('  Biggest gains:');
  [...rows].sort((a, b) => (b.v2 - b.v1) - (a.v2 - a.v1)).slice(0, 10).forEach((r) => console.log(line(r)));
  console.log('  Biggest drops:');
  [...rows].sort((a, b) => (a.v2 - a.v1) - (b.v2 - b.v1)).slice(0, 10).forEach((r) => console.log(line(r)));
}

// Comeback bonus: every point of the loser's lead beyond comeback.fullAt adds bonusPerPoint.
// Compares a few values on the season (v2 rating when the play-by-play is there).
function comebackBonusReport(games: CachedGame[], late: Map<string, NonNullable<Game['late']>>): void {
  const c = SCORING.comeback;
  title(`Comeback bonus beyond ${c.fullAt} (now: ${c.bonusPerPoint} per point)`);
  const withLate = (g: CachedGame) => (late.has(g.id) ? { ...g, late: late.get(g.id)! } : g);
  const big = games.filter((g) => loserBiggestLead(g) > c.fullAt).sort((a, b) => loserBiggestLead(b) - loserBiggestLead(a));
  console.log(`  ${big.length} games where the loser led by more than ${c.fullAt} (${pct(big.length, games.length)}).`);
  const values = [0, 0.5, 1, 1.5];
  const saved = c.bonusPerPoint;
  const ratings = values.map((b) => {
    c.bonusPerPoint = b;
    return new Map(games.map((g) => [g.id, displayScore(withLate(g))]));
  });
  c.bonusPerPoint = saved;
  console.log(`  100s:        ${values.map((b, k) => `${b} → ${[...ratings[k]!.values()].filter((x) => x === 100).length}`).join('   ')}`);
  console.log(`  50 or more:  ${values.map((b, k) => `${b} → ${pct([...ratings[k]!.values()].filter((x) => x >= 50).length, games.length)}`).join('   ')}`);
  console.log(`  Biggest comebacks (rating with a bonus of ${values.join(' / ')} per point):`);
  for (const g of big.slice(0, 15)) {
    console.log(`    ${label(g).padEnd(22)} loser led by ${String(loserBiggestLead(g)).padStart(2)}   ${values.map((_, k) => String(ratings[k]!.get(g.id)).padStart(3)).join(' / ')}`);
  }
}

// The "?" on the cards (src/lib/why.ts), with the settings in use: how often, and why.
function whyReport(games: CachedGame[], late: Map<string, NonNullable<Game['late']>>): void {
  const w = SCORING.why;
  title(`Why — the "?" on the cards (big ${w.bigNight}, huge ${w.hugeNight}, crazy ${w.crazyNight})`);
  const rows = games.map((g0) => {
    const g = late.has(g0.id) ? { ...g0, late: late.get(g0.id)! } : g0;
    return { note: displayScore(g), why: whyOf(g) };
  });
  const n = rows.length;
  const nights = new Set(games.map((g) => g.date).filter(Boolean)).size || 165;
  const k = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
  const line = (name: string, count: number, of = n) =>
    console.log(`  ${name.padEnd(34)} ${String(count).padStart(5)}  ${pct(count, of).padStart(6)}  ≈ ${n1(count / nights).padStart(4)} per night`);

  line('games with a "?"', k((r) => r.why !== undefined));
  line('  with a big performance', k((r) => (r.why?.big ?? 0) > 0));
  line('  with a huge performance', k((r) => (r.why?.huge ?? 0) > 0));
  line('  with a crazy performance', k((r) => (r.why?.crazy ?? 0) > 0));
  const high = rows.filter((r) => r.note >= 50);
  const low = rows.filter((r) => r.note < 50);
  console.log(`  "?" at 50% or more: ${pct(high.filter((r) => r.why).length, high.length)}  ·  under 50%: ${pct(low.filter((r) => r.why).length, low.length)}`);

  // Players per tier (each in one tier only)
  const players = (tier: 'big' | 'huge' | 'crazy') => rows.reduce((s, r) => s + (r.why?.[tier] ?? 0), 0);
  console.log(`  Players: big ${players('big')} · huge ${players('huge')} · crazy ${players('crazy')}`);
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
      const f = finalScore(g);
      pbp.set(g.id, {
        clutch: computeClutch(timeline, g.periods.length), late: lateFrom(timeline, g.periods.length),
        count: swings(timeline).length, complete: timelineMatches(timeline, f.home, f.away),
      });
    }
    clutchReport(games, pbp);
    comebackBonusReport(games, new Map([...pbp].map(([id, x]) => [id, x.late])));
    whyReport(games, new Map([...pbp].map(([id, x]) => [id, x.late])));

    // Every game's rating (v2 when the play-by-play is there), for charts. Teams, date and rating only:
    // no score, no settings.
    const csv = ['date,away,home,rating', ...games.map((g) => {
      const x = pbp.get(g.id);
      return `${g.date ?? ''},${g.away},${g.home},${displayScore(x ? { ...g, late: x.late } : g)}`;
    })].join('\n') + '\n';
    const out = path.join(ROOT, '.cache', `ratings-${season}.csv`);
    await writeFile(out, csv);
    console.log(`\nEvery game's rating: ${path.relative(ROOT, out)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
