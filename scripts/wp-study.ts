// scripts/wp-study.ts
// Study (November 7): rate the story of a game with a win probability model instead of rules.
//   1. Fit the model on the downloaded seasons: the score margin moves like a random walk with a small home
//      edge, so P(home wins) = Φ((margin + μ·τ) / (σ·√τ)), τ = share of the game left (Stern, 1994).
//      μ and σ are fitted on every score change of every game; then the calibration (predicted vs actual).
//   2. Each game's curve, and a few measures: agitation (sum of the probability moves, the late ones weigh
//      more), doubt in the fourth (seconds with the home win probability between 20 and 80%), the comeback
//      (the lowest probability the winner had).
//   3. Compared with the current rating: correlation, and the biggest disagreements.
// Local only, like the other studies (it prints games and how the rating behaves).
//
// Usage: npm run wp-study -- 2019-20 2020-21 2021-22 2022-23 2023-24 2024-25 2025-26 > rapport-wp.txt

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lateFrom, type Timeline } from './nba/clutch.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import { competitivenessPoints, disputedBaseFor, displayScore, finalScore, isDisputed } from '../src/lib/scoring.ts';
import type { Game } from '../src/types/game.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
type CachedGame = Game & { id: string; date?: string };
type Row = { g: CachedGame; tl: Timeline; season: string; note: number; story: number; homeWon: boolean };

const GAME = 2880; // 48 minutes, in seconds

// Seconds left in regulation (or in the overtime being played), as a share of a whole game
const tauOf = (period: number, left: number) => (period <= 4 ? (4 - period) * 720 + left : left) / GAME;

// Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7)
function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const wpHome = (margin: number, tau: number, mu: number, sigma: number) => {
  if (tau <= 0) return margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
  return phi((margin + mu * tau) / (sigma * Math.sqrt(tau)));
};

// The states of a game: the margin (home − away) and the time left after each score change, plus the tip-off
function states(tl: Timeline): { period: number; left: number; margin: number }[] {
  return [{ period: 1, left: 720, margin: 0 }, ...tl.map(([period, left, h, a]) => ({ period, left, margin: h - a }))];
}

function fit(rows: Row[]): { mu: number; sigma: number } {
  // A sample of states, each with the final result (deterministic: every 4th score change)
  const sample: { m: number; tau: number; won: boolean }[] = [];
  for (const r of rows) {
    states(r.tl).forEach((s, i) => {
      const tau = tauOf(s.period, s.left);
      if (i % 4 === 0 && tau > 0 && s.period <= 4) sample.push({ m: s.margin, tau, won: r.homeWon });
    });
  }
  const ll = (mu: number, sigma: number) => sample.reduce((acc, s) => {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, wpHome(s.m, s.tau, mu, sigma)));
    return acc + Math.log(s.won ? p : 1 - p);
  }, 0);
  let best = { mu: 0, sigma: 12, ll: -Infinity };
  for (let sigma = 6; sigma <= 22; sigma += 0.5) {
    for (let mu = 0; mu <= 6; mu += 0.5) {
      const v = ll(mu, sigma);
      if (v > best.ll) best = { mu, sigma, ll: v };
    }
  }
  // Refine around the best point
  const coarse = { ...best };
  for (let sigma = coarse.sigma - 0.5; sigma <= coarse.sigma + 0.5; sigma += 0.1) {
    for (let mu = Math.max(0, coarse.mu - 0.5); mu <= coarse.mu + 0.5; mu += 0.1) {
      const v = ll(mu, sigma);
      if (v > best.ll) best = { mu, sigma, ll: v };
    }
  }
  console.log(`  ${sample.length} states sampled from ${rows.length} games`);
  return { mu: Math.round(best.mu * 10) / 10, sigma: Math.round(best.sigma * 10) / 10 };
}

function calibration(rows: Row[], mu: number, sigma: number): void {
  const bins = Array.from({ length: 10 }, () => ({ n: 0, won: 0, p: 0 }));
  for (const r of rows) {
    for (const s of states(r.tl)) {
      const tau = tauOf(s.period, s.left);
      if (tau <= 0 || s.period > 4) continue;
      const p = wpHome(s.margin, tau, mu, sigma);
      const b = bins[Math.min(9, Math.floor(p * 10))]!;
      b.n++; b.p += p; if (r.homeWon) b.won++;
    }
  }
  console.log('  predicted home win   states    actual home win');
  bins.forEach((b, i) => {
    if (b.n) console.log(`  ${`${i * 10}–${i * 10 + 10}%`.padEnd(10)} (${(100 * b.p / b.n).toFixed(1).padStart(5)}%)   ${String(b.n).padStart(7)}    ${(100 * b.won / b.n).toFixed(1).padStart(5)}%`);
  });
}

// The measures of a game's curve
type Curve = { agitation: number; doubtQ4: number; comeback: number; lastTwo: number };
function curve(r: Row, mu: number, sigma: number): Curve {
  const w = SCORING.swings;
  const weight = (period: number, left: number) =>
    (period >= 4 && left <= 300 ? w.late : period === 1 ? w.q1 : period === 2 ? w.q2 : period === 3 ? w.q3 : w.q4);
  const ss = states(r.tl);
  let agitation = 0, lastTwo = 0, doubtQ4 = 0;
  let prev = wpHome(0, 1, mu, sigma);
  let winnerMin = r.homeWon ? prev : 1 - prev;
  for (let i = 1; i < ss.length; i++) {
    const s = ss[i]!, before = ss[i - 1]!;
    const p = wpHome(s.margin, tauOf(s.period, s.left), mu, sigma);
    agitation += Math.abs(p - prev) * weight(s.period, s.left);
    if (s.period >= 4 && s.left <= 120) lastTwo += Math.abs(p - prev);
    // Doubt: the time between the two score changes, in the fourth or an overtime, with the probability of the
    // state before between 20 and 80%
    if (s.period >= 4) {
      const from = before.period === s.period ? before.left : s.period === 4 ? 720 : 300;
      const pBefore = wpHome(before.margin, tauOf(s.period, from), mu, sigma);
      if (pBefore >= 0.2 && pBefore <= 0.8) doubtQ4 += Math.max(0, from - s.left);
    }
    winnerMin = Math.min(winnerMin, r.homeWon ? p : 1 - p);
    prev = p;
  }
  return { agitation, doubtQ4, comeback: winnerMin, lastTwo };
}

// Spearman's rank correlation
function spearman(xs: number[], ys: number[]): number {
  const rank = (v: number[]) => {
    const order = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < order.length;) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
      for (let k = i; k <= j; k++) r[order[k]![1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs), ry = rank(ys);
  const n = xs.length, mx = (n - 1) / 2;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i]! - mx) * (ry[i]! - mx); dx += (rx[i]! - mx) ** 2; dy += (ry[i]! - mx) ** 2; }
  return num / Math.sqrt(dx * dy);
}

function story(r: Row): string {
  const g = r.g;
  let h = 0, a = 0;
  const q = g.periods.map((p, i) => { h += p.home; a += p.away; return `${i < 4 ? `Q${i + 1}` : `OT${i - 3}`} ${h - a > 0 ? '+' : ''}${h - a}`; }).join(' ');
  return `${g.home} ${q}`;
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') throw new Error('wp-study prints games and how the rating behaves: never on GitHub Actions (public logs).');
  const seasons = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}$/.test(a));
  if (seasons.length === 0) throw new Error('Usage: npm run wp-study -- 2025-26 [2024-25 …]');
  loadScoring();

  const rows: Row[] = [];
  for (const season of seasons) {
    const dir = path.join(ROOT, '.cache', 'boxscores', season);
    const pbpDir = path.join(ROOT, '.cache', 'playbyplay', season);
    if (!existsSync(dir)) throw new Error(`No box score in ${dir}.`);
    for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json'))) {
      const pbp = path.join(pbpDir, f);
      if (!existsSync(pbp)) continue;
      const g0 = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as CachedGame;
      const tl = JSON.parse(await readFile(pbp, 'utf8')) as Timeline;
      const g = { ...g0, late: lateFrom(tl, g0.periods.length) };
      const fs = finalScore(g);
      if (fs.home === fs.away) continue;
      const storyPts = (isDisputed(g) ? disputedBaseFor(g) : 0) + competitivenessPoints(g);
      rows.push({ g, tl, season, note: displayScore(g), story: storyPts, homeWon: fs.home > fs.away });
    }
  }
  console.log(`Win probability study, ${seasons.join(' + ')}: ${rows.length} games with their play-by-play\n`);

  console.log('=== 1. The model: P(home wins) = Φ((margin + μ·τ) / (σ·√τ)), τ = share of the game left ===');
  const { mu, sigma } = fit(rows);
  console.log(`  fitted: home edge μ = ${mu} points over a game, σ = ${sigma} points`);
  for (const [m, t] of [[2, 300], [5, 300], [8, 360], [10, 360], [12, 360], [15, 360], [10, 120], [20, 720]] as const) {
    console.log(`  up ${String(m).padStart(2)} with ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} left (home team): ${(100 * wpHome(m, t / GAME, mu, sigma)).toFixed(1)}% · (away team): ${(100 * (1 - wpHome(-m, t / GAME, mu, sigma))).toFixed(1)}%`);
  }
  console.log('\n  calibration (regulation states):');
  calibration(rows, mu, sigma);

  console.log('\n=== 2. The curves ===');
  const curves = rows.map((r) => curve(r, mu, sigma));
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]!; };
  for (const [label, get, fmt] of [
    ['agitation (weighted sum of moves)', (c: Curve) => c.agitation, (x: number) => x.toFixed(2)],
    ['doubt in Q4/OT (seconds at 20–80%)', (c: Curve) => c.doubtQ4, (x: number) => x.toFixed(0)],
    ['comeback (winner\'s lowest chance)', (c: Curve) => c.comeback, (x: number) => `${(100 * x).toFixed(0)}%`],
    ['last two minutes (sum of moves)', (c: Curve) => c.lastTwo, (x: number) => x.toFixed(2)],
  ] as const) {
    const xs = curves.map(get);
    console.log(`  ${label.padEnd(38)} median ${fmt(q(xs, 0.5))} · 25th ${fmt(q(xs, 0.25))} · 75th ${fmt(q(xs, 0.75))} · 95th ${fmt(q(xs, 0.95))} · max ${fmt(q(xs, 1))}`);
  }

  console.log('\n=== 3. Compared with the current rating (the story part: base + competitiveness, no performances) ===');
  const story0 = rows.map((r) => r.story);
  for (const [label, get] of [
    ['agitation', (c: Curve) => c.agitation], ['doubt in Q4/OT', (c: Curve) => c.doubtQ4],
    ['comeback', (c: Curve) => -c.comeback], ['last two minutes', (c: Curve) => c.lastTwo],
  ] as const) {
    console.log(`  rank correlation with the current story: ${label.padEnd(18)} ${spearman(curves.map(get), story0).toFixed(2)}`);
  }

  // Disagreements, on agitation: rank each game in both, show the biggest gaps
  const n = rows.length;
  const rankOf = (xs: number[]) => { const order = xs.map((x, i) => [x, i] as const).sort((a, b) => b[0] - a[0]); const r = new Array<number>(n); order.forEach(([, i], k) => { r[i] = k; }); return r; };
  const rA = rankOf(curves.map((c) => c.agitation)), rS = rankOf(story0);
  const line = (i: number) => {
    const r = rows[i]!, c = curves[i]!;
    return `    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} rated ${String(r.note).padStart(3)} (story ${r.story.toFixed(0).padStart(3)}) · agitation ${c.agitation.toFixed(2)} · doubt ${c.doubtQ4.toFixed(0).padStart(3)} s · comeback ${(100 * c.comeback).toFixed(0).padStart(2)}% · last 2:00 ${c.lastTwo.toFixed(2)} · ${story(r)}`;
  };
  const idx = rows.map((_, i) => i);
  console.log('\n  the most agitated games (top 15):');
  for (const i of [...idx].sort((a, b) => rA[a]! - rA[b]!).slice(0, 15)) console.log(line(i));
  console.log('\n  agitated, but a modest story today (agitation in the top 20%, story in the bottom half):');
  for (const i of idx.filter((i) => rA[i]! < n * 0.2 && rS[i]! > n * 0.5).sort((a, b) => rA[a]! - rA[b]!).slice(0, 15)) console.log(line(i));
  console.log('\n  a big story today, but a calm curve (story in the top 20%, agitation in the bottom half):');
  for (const i of idx.filter((i) => rS[i]! < n * 0.2 && rA[i]! > n * 0.5).sort((a, b) => rS[a]! - rS[b]!).slice(0, 15)) console.log(line(i));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
