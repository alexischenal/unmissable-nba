// scripts/flame-study.ts
// Where should the flame start? A whole season of box scores, read at several efficiency thresholds:
// how often the flame shows, on which games, for whom, and what a night just at the threshold looks like.
// Local only: it prints player names and how the settings behave (the logs of a public repo are public).
//
// Usage (after npm run season-stats -- 2025-26 --clutch, which fills .cache/):
//   npm run flame-study -- 2025-26            → the study, focused on the current bigNight threshold
//   npm run flame-study -- 2025-26 --at 40    → the same, focused on 40
//
// The nights are grouped by the UTC date of the game (all the cache keeps): close to the real nights,
// not exact (a 1 p.m. Sunday game and the Saturday night games share a date).

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lateFrom, type Timeline } from './nba/clutch.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import { displayScore, efficiency } from '../src/lib/scoring.ts';
import type { Game, PlayerLine } from '../src/types/game.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
type CachedGame = Game & { id: string; date?: string };
type Row = { g: CachedGame; note: number; effs: number[]; best: number };

const THRESHOLDS = [32, 34, 36, 38, 40, 42, 45, 50];

const pct = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(0)}%` : '-');
const n1 = (x: number) => x.toFixed(1);
const title = (t: string) => console.log(`\n=== ${t} ===`);
const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
const teamOf = (g: Game, p: PlayerLine) => (p.team === 'home' ? g.home : g.away);

function line(p: PlayerLine): string {
  return `${p.pts} pts ${p.reb} reb ${p.ast} ast ${p.stl} stl ${p.blk} blk · ${p.fgm}/${p.fga} FG ${p.ftm}/${p.fta} FT · ${p.tov} TO`;
}

function thresholdTable(rows: Row[], nights: Map<string, Row[]>): void {
  title('The flame at each threshold');
  console.log('  eff ≥   games   per night   nights w/o   2+ flames   at 50%+   under 50%   at 100%   top game of night');
  const high = rows.filter((r) => r.note >= 50);
  const low = rows.filter((r) => r.note < 50);
  const hundred = rows.filter((r) => r.note >= 100);
  const tops = [...nights.values()].map((games) => [...games].sort((a, b) => b.note - a.note)[0]!);
  for (const t of THRESHOLDS) {
    const lit = (r: Row) => r.best >= t;
    const empty = [...nights.values()].filter((games) => !games.some(lit)).length;
    const perNight = rows.filter(lit).length / nights.size;
    console.log(
      `  ${String(t).padStart(5)}   ${pct(rows.filter(lit).length, rows.length).padStart(5)}   ${n1(perNight).padStart(9)}   ` +
      `${pct(empty, nights.size).padStart(10)}   ${pct(rows.filter((r) => r.effs.filter((e) => e >= t).length >= 2).length, rows.length).padStart(9)}   ` +
      `${pct(high.filter(lit).length, high.length).padStart(7)}   ${pct(low.filter(lit).length, low.length).padStart(9)}   ` +
      `${pct(hundred.filter(lit).length, hundred.length).padStart(7)}   ${pct(tops.filter(lit).length, tops.length).padStart(17)}`,
    );
  }
  console.log(`  (${rows.length} games, ${nights.size} nights, ${high.length} at 50%+, ${hundred.length} at 100%)`);
}

function nightsReport(nights: Map<string, Row[]>, at: number): void {
  title(`A night at ${at}+: how many flames on screen`);
  const counts = new Map<number, number>();
  const shares: number[] = [];
  for (const games of nights.values()) {
    const lit = games.filter((r) => r.best >= at).length;
    counts.set(Math.min(lit, 5), (counts.get(Math.min(lit, 5)) ?? 0) + 1);
    if (games.length >= 5) shares.push(lit / games.length);
  }
  console.log(`  flames per night: ${[0, 1, 2, 3, 4, 5].map((k) => `${k === 5 ? '5+' : k} → ${pct(counts.get(k) ?? 0, nights.size)}`).join('   ')}`);
  shares.sort((a, b) => a - b);
  if (shares.length) {
    console.log(`  on nights of 5+ games, share of cards with a flame: median ${pct(quantile(shares, 0.5), 1)}, 90th pct ${pct(quantile(shares, 0.9), 1)}, max ${pct(shares[shares.length - 1]!, 1)}`);
  }
}

function distribution(rows: Row[]): void {
  title('Best efficiency of each game');
  const best = rows.map((r) => r.best).sort((a, b) => a - b);
  console.log(`  median ${quantile(best, 0.5)} · 75th ${quantile(best, 0.75)} · 90th ${quantile(best, 0.9)} · 95th ${quantile(best, 0.95)} · 99th ${quantile(best, 0.99)} · max ${best[best.length - 1]}`);
  const all = rows.flatMap((r) => r.effs).filter((e) => e >= 20).sort((a, b) => a - b);
  const bins = [20, 25, 30, 34, 38, 42, 46, 50, 56];
  console.log(`  player lines, by efficiency: ${bins.map((b, i) => {
    const next = bins[i + 1] ?? Infinity;
    return `${b}${next === Infinity ? '+' : `–${next - 1}`} ${all.filter((e) => e >= b && e < next).length}`;
  }).join(' · ')}`);
}

function concentration(rows: Row[], at: number): void {
  title(`Who lights the flame at ${at}+`);
  const players = new Map<string, { team: string; lit: number; games: number }>();
  const teams = new Map<string, { lit: number; games: number }>();
  for (const r of rows) {
    for (const abbr of [r.g.home, r.g.away]) {
      const t = teams.get(abbr) ?? { lit: 0, games: 0 };
      t.games++;
      if (r.g.players.some((p) => teamOf(r.g, p) === abbr && efficiency(p) >= at)) t.lit++;
      teams.set(abbr, t);
    }
    for (const p of r.g.players) {
      if (!p.name) continue;
      const x = players.get(p.name) ?? { team: teamOf(r.g, p), lit: 0, games: 0 };
      x.games++;
      if (efficiency(p) >= at) x.lit++;
      players.set(p.name, x);
    }
  }
  const litLines = rows.reduce((s, r) => s + r.effs.filter((e) => e >= at).length, 0);
  const top = [...players.entries()].filter(([, x]) => x.lit > 0).sort((a, b) => b[1].lit - a[1].lit);
  console.log(`  ${top.length} different players, ${litLines} lines. Top 12:`);
  let cumul = 0;
  for (const [name, x] of top.slice(0, 12)) {
    cumul += x.lit;
    console.log(`    ${name.padEnd(26)} ${x.team}  ${String(x.lit).padStart(3)} of ${String(x.games).padStart(2)} games (${pct(x.lit, x.games).padStart(4)})`);
  }
  console.log(`  the top 12 make ${pct(cumul, litLines)} of the lines; top 5: ${pct(top.slice(0, 5).reduce((s, [, x]) => s + x.lit, 0), litLines)}`);
  const byTeam = [...teams.entries()].sort((a, b) => b[1].lit / b[1].games - a[1].lit / a[1].games);
  const fmt = ([abbr, t]: [string, { lit: number; games: number }]) => `${abbr} ${pct(t.lit, t.games)}`;
  console.log(`  games where the team has the flame, most: ${byTeam.slice(0, 6).map(fmt).join(' · ')}`);
  console.log(`  least: ${byTeam.slice(-6).map(fmt).join(' · ')}`);
}

function borderline(rows: Row[], at: number): void {
  title(`Just around ${at}: does it look like a big night?`);
  const lines = rows.flatMap((r) => r.g.players.map((p) => ({ r, p, e: efficiency(p) })));
  for (const e of [at - 2, at - 1, at, at + 1, at + 2]) {
    const pick = lines.filter((x) => x.e === e);
    const step = Math.max(1, Math.floor(pick.length / 3));
    console.log(`  eff ${e} (${pick.length} lines):`);
    for (const x of [pick[0], pick[step], pick[2 * step]].filter(Boolean)) {
      console.log(`    ${(x!.p.name ?? '?').padEnd(24)} ${line(x!.p)}   game ${x!.r.note}%`);
    }
  }
  const kinds = lines.filter((x) => x.e >= at);
  const scorer = kinds.filter((x) => x.p.pts >= 35).length;
  const allAround = kinds.filter((x) => [x.p.pts, x.p.reb, x.p.ast].filter((v) => v >= 10).length >= 3).length;
  const glass = kinds.filter((x) => x.p.reb >= 18).length;
  console.log(`  at ${at}+ (${kinds.length} lines): 35+ points ${pct(scorer, kinds.length)} · triple-double ${pct(allAround, kinds.length)} · 18+ rebounds ${pct(glass, kinds.length)}`);
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('flame-study prints player names and how the settings behave: never on GitHub Actions (public logs).');
  }
  const args = process.argv.slice(2);
  const season = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  if (!season) throw new Error('Usage: npm run flame-study -- 2025-26 [--at 40]');
  loadScoring();
  const atArg = args.indexOf('--at');
  const at = atArg >= 0 ? Number(args[atArg + 1]) : SCORING.why.bigNight;
  if (!Number.isFinite(at)) throw new Error('--at needs a number, e.g. --at 40');

  const dir = path.join(ROOT, '.cache', 'boxscores', season);
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) throw new Error(`No box score in ${dir}: run npm run season-stats -- ${season} --clutch first.`);
  const pbpDir = path.join(ROOT, '.cache', 'playbyplay', season);

  const rows: Row[] = [];
  let v2 = 0;
  for (const f of files) {
    const g0 = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as CachedGame;
    const pbp = path.join(pbpDir, f);
    let g = g0;
    if (existsSync(pbp)) {
      g = { ...g0, late: lateFrom(JSON.parse(await readFile(pbp, 'utf8')) as Timeline, g0.periods.length) };
      v2++;
    }
    const effs = g.players.map(efficiency);
    rows.push({ g, note: displayScore(g), effs, best: Math.max(0, ...effs) });
  }
  const nights = new Map<string, Row[]>();
  for (const r of rows) nights.set(r.g.date ?? '?', [...(nights.get(r.g.date ?? '?') ?? []), r]);

  console.log(`Flame study, ${season}: ${rows.length} games (${v2} rated with the play-by-play), focus on ${at}+`);
  distribution(rows);
  thresholdTable(rows, nights);
  nightsReport(nights, at);
  concentration(rows, at);
  borderline(rows, at);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
