// scripts/wp-study.ts
// Study (November 7): rate the story of a game with a win probability model instead of rules.
//   1. Fit the model on the downloaded seasons: the score margin moves like a random walk with a small home
//      edge, so P(home wins) = Φ((margin + μ·τ) / (σ·√τ)), τ = share of the game left (Stern, 1994).
//      μ and σ are fitted on every score change of every game; then the calibration (predicted vs actual).
//   2. Each game's curve, and a few measures: agitation (sum of the probability moves, the late ones weigh
//      more), doubt in the fourth (seconds with the home win probability between 20 and 80%), the comeback
//      (the lowest probability the winner had).
//   3. Compared with the current rating: correlation, and the biggest disagreements.
//   4. (November 8) A safety net: the loser's best chance after 6:00 in the fourth, against the bar the
//      6:00 door already accepts (down 12 with 6:00 left). The games the net would catch, the film of their
//      last six minutes, and the reverse check (competitive games today that stay under the bar).
//   5. The net at 10% with three versions of the comeback door (kept, removed, kept if alive in Q4).
//   6. The comeback door replaced by the doubt in the fourth (the loser's best chance before 6:00 ≥ X%).
//   7. The spicy rocks lost and won with the doubt in the fourth at 33% and the 10% net.
// Local only, like the other studies (it prints games and how the rating behaves).
//
// Usage: npm run wp-study -- 2019-20 2020-21 2021-22 2022-23 2023-24 2024-25 2025-26 > rapport-wp.txt

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lateFrom, type Timeline } from './nba/clutch.ts';
import { loadPeaks } from './load-peaks.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import {
  closeByClutch, closeFinalMargin, competitivenessPoints, efficiency, disputedBaseFor, displayScore, finalScore, isDisputed, loserBiggestLead,
  performancePoints,
} from '../src/lib/scoring.ts';
import type { Game, PlayerLine } from '../src/types/game.ts';
import { whyOf } from '../src/lib/why.ts';

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

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const pct1 = (x: number) => `${(100 * x).toFixed(1)}%`;

// The loser's best chance from 6:00 in the fourth to the end of regulation: at 6:00, then right after every
// score (between two scores the chance only drops as the clock runs). Plus the film: the winner's lead and
// the loser's chance after every score.
const marginAt = (tl: Timeline, left0: number) => {
  let m = 0;
  for (const [period, left, h, a] of tl) if (period < 4 || (period === 4 && left > left0)) m = h - a;
  return m;
};
type Net = { best: number; at: number; lead6: number; film: string[] };
function netOf(r: Row, mu: number, sigma: number, from = 360): Net {
  const sign = r.homeWon ? 1 : -1;
  const loserWp = (margin: number, left: number) => {
    const p = wpHome(margin, left / GAME, mu, sigma);
    return r.homeWon ? 1 - p : p;
  };
  let margin = 0;
  for (const [period, left, h, a] of r.tl) if (period < 4 || (period === 4 && left > from)) margin = h - a;
  const lead6 = sign * marginAt(r.tl, 360);
  let best = loserWp(margin, from);
  let at = from;
  const film: string[] = [];
  for (const [period, left, h, a] of r.tl) {
    if (period !== 4 || left > from) continue;
    const wp = loserWp(h - a, left);
    film.push(`${clock(left)} ${sign * (h - a)} (${(100 * wp).toFixed(0)}%)`);
    if (wp > best) { best = wp; at = left; }
  }
  return { best, at, lead6, film };
}

function safetyNet(rows: Row[], mu: number, sigma: number): void {
  console.log('\n=== 4. A safety net: the loser still had a real chance after 6:00 ===');
  const tau6 = 360 / GAME;
  const bar = Math.min(wpHome(-12, tau6, mu, sigma), 1 - wpHome(12, tau6, mu, sigma));
  console.log(`  the bar: down 12 with 6:00 left, the least alive game the 6:00 door accepts = ${pct1(bar)} for the loser`);
  console.log(`  (home team down 12: ${pct1(wpHome(-12, tau6, mu, sigma))} · away team down 12: ${pct1(1 - wpHome(12, tau6, mu, sigma))})`);
  console.log('  the same bar later: the biggest deficit still at it, by time left');
  for (const left of [300, 240, 180, 120, 90, 60, 30, 10]) {
    let m = 0;
    while (Math.min(wpHome(-(m + 1), left / GAME, mu, sigma), 1 - wpHome(m + 1, left / GAME, mu, sigma)) >= bar) m++;
    console.log(`    ${clock(left).padStart(5)} left: down ${m} or less`);
  }

  const seasons = [...new Set(rows.map((r) => r.season))].length;
  const nets = rows.map((r) => netOf(r, mu, sigma));
  const blow = rows.map((r, i) => ({ r, n: nets[i]! })).filter((x) => !isDisputed(x.r.g));
  console.log(`\n  ${blow.length} blowouts today · caught by the net, by bar:`);
  for (const x of [bar, 0.05, 0.1, 0.15, 0.2]) {
    const c = blow.filter((b) => b.n.best >= x).length;
    console.log(`    ${(x === bar ? `${pct1(x)} (the bar)` : pct1(x)).padEnd(16)} ${String(c).padStart(4)} games · ${(c / seasons).toFixed(1)} per season`);
  }

  const caught = blow.filter((b) => b.n.best >= bar).sort((a, b) => b.n.best - a.n.best);
  console.log(`\n  caught at the bar (${caught.length}), best chance first: rated today → with base 50, the loser's best chance and when, the film (winner's lead, loser's chance)`);
  for (const { r, n } of caught) {
    const with50 = Math.min(100, Math.round(SCORING.disputedBase + competitivenessPoints(r.g) + performancePoints(r.g)));
    console.log(`\n    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(with50).padStart(3)}   best ${pct1(n.best)} at ${clock(n.at)} · lead at 6:00 ${n.lead6} · ${story(r)}`);
    for (let i = 0; i < n.film.length; i += 10) console.log(`      ${n.film.slice(i, i + 10).join(' · ')}`);
  }

  // The reverse check: competitive today, but never at the bar after 6:00. Which door let them in?
  const comp = rows.map((r, i) => ({ r, n: nets[i]! })).filter((x) => isDisputed(x.r.g) && x.r.g.periods.length === 4);
  const under = comp.filter((x) => x.n.best < bar);
  console.log(`\n  reverse check: ${comp.length} competitive games today (no overtime), ${under.length} (${((100 * under.length) / comp.length).toFixed(1)}%) never at the bar after 6:00`);
  const doors = (g: Row['g']) => [
    closeFinalMargin(g) && 'close final margin',
    loserBiggestLead(g) >= SCORING.disputed.minLoserBiggestLead && `loser led by ${loserBiggestLead(g)}`,
    closeByClutch(g) && 'close by clutch',
    (g.late?.clutchSeconds ?? 0) > 0 && `clutch ${g.late!.clutchSeconds} s`,
    g.late?.marginAt6 !== undefined && g.late.marginAt6 <= SCORING.disputed.maxMarginAt6 && `${g.late.marginAt6} at 6:00`,
  ].filter(Boolean).join(', ');
  for (const { r, n } of under.sort((a, b) => a.n.best - b.n.best).slice(0, 20)) {
    console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} rated ${String(r.note).padStart(3)}   best ${pct1(n.best)} at ${clock(n.at)} · lead at 6:00 ${n.lead6} · in by: ${doors(r.g)} · ${story(r)}`);
  }
}

// November 8: the safety net at 10%, with three versions of the comeback door (the loser led by
// minLoserBiggestLead or more): kept as today, removed, or kept only when the loser still had the bar's
// chance at some point in the fourth (from 12:00). Only regulation and overtime games with the play-by-play.
function netAndComeback(rows: Row[], mu: number, sigma: number): void {
  console.log('\n=== 5. The net at 10% and the comeback door ===');
  const tau6 = 360 / GAME;
  const bar = Math.min(wpHome(-12, tau6, mu, sigma), 1 - wpHome(12, tau6, mu, sigma));
  const after6 = rows.map((r) => netOf(r, mu, sigma).best);
  const inQ4 = rows.map((r) => netOf(r, mu, sigma, 720).best);
  const otherDoors = (g: Row['g']) => closeFinalMargin(g) || closeByClutch(g)
    || (g.late !== undefined && (g.late.clutchSeconds > 0 || (g.late.marginAt6 !== undefined && g.late.marginAt6 <= SCORING.disputed.maxMarginAt6)));
  const led = (g: Row['g']) => loserBiggestLead(g) >= SCORING.disputed.minLoserBiggestLead;
  const rate = (r: Row, close: boolean) => {
    const pts = competitivenessPoints(r.g) + performancePoints(r.g);
    return Math.min(100, Math.round(close ? SCORING.disputedBase + pts : Math.min(SCORING.blowoutMax, pts)));
  };
  const variants: { label: string; close: (r: Row, i: number) => boolean }[] = [
    { label: 'today', close: (r) => isDisputed(r.g) },
    { label: 'net 10%', close: (r, i) => isDisputed(r.g) || after6[i]! >= 0.1 },
    { label: 'net 10%, no comeback door', close: (r, i) => otherDoors(r.g) || after6[i]! >= 0.1 },
    { label: `net 10%, comeback alive in Q4 (${(100 * bar).toFixed(1)}%)`, close: (r, i) => otherDoors(r.g) || after6[i]! >= 0.1 || (led(r.g) && inQ4[i]! >= bar) },
  ];
  const base = rows.map((r) => isDisputed(r.g));
  const fmtLine = (r: Row, i: number, before: number, after: number) => `    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(before).padStart(3)} → ${String(after).padStart(3)}   loser led by ${String(loserBiggestLead(r.g)).padStart(2)} · lead at 6:00 ${String(Math.abs(marginAt(r.tl, 360))).padStart(2)} · loser's best: Q4 ${(100 * inQ4[i]!).toFixed(1)}%, after 6:00 ${(100 * after6[i]!).toFixed(1)}% · ${story(r)}`;
  const seasons = new Set(rows.map((r) => r.season)).size;
  console.log('  variant                                       close   50%+   in   out   (per season)');
  const results = variants.map((v) => {
    const close = rows.map((r, i) => v.close(r, i));
    const notes = rows.map((r, i) => rate(r, close[i]!));
    const ins = rows.map((_, i) => i).filter((i) => close[i] && !base[i]);
    const outs = rows.map((_, i) => i).filter((i) => !close[i] && base[i]);
    console.log(`  ${v.label.padEnd(44)} ${`${((100 * close.filter(Boolean).length) / rows.length).toFixed(1)}%`.padStart(6)} ${`${((100 * notes.filter((n) => n >= 50).length) / rows.length).toFixed(1)}%`.padStart(6)} ${String(ins.length).padStart(4)} ${String(outs.length).padStart(5)}   (${(ins.length / seasons).toFixed(1)} in, ${(outs.length / seasons).toFixed(1)} out)`);
    return { label: v.label, ins, outs, notes };
  });
  const today = rows.map((r) => r.note);
  for (const v of results.slice(1)) {
    console.log(`\n  ${v.label}: in (${v.ins.length})`);
    for (const i of [...v.ins].sort((a, b) => after6[b]! - after6[a]!)) console.log(fmtLine(rows[i]!, i, today[i]!, v.notes[i]!));
    if (v.outs.length === 0) continue;
    const sorted = [...v.outs].sort((a, b) => inQ4[b]! - inQ4[a]!);
    console.log(`  ${v.label}: out (${v.outs.length}), the most alive in Q4 first (first 25), then the least (last 10)`);
    for (const i of sorted.slice(0, 25)) console.log(fmtLine(rows[i]!, i, today[i]!, v.notes[i]!));
    if (sorted.length > 25) {
      console.log('    …');
      for (const i of sorted.slice(-10)) console.log(fmtLine(rows[i]!, i, today[i]!, v.notes[i]!));
    }
  }
}

// November 8: the comeback door replaced by a statistical one, the doubt in the fourth: the loser had at
// least X% at some point of the fourth before 6:00 (at 12:00, then right after every score). After 6:00,
// the 12-point door and the 10% net. The comeback (the loser's lead) only gives bonus points.
function bestBefore6(r: Row, mu: number, sigma: number): number {
  const loserWp = (margin: number, left: number) => {
    const p = wpHome(margin, left / GAME, mu, sigma);
    return r.homeWon ? 1 - p : p;
  };
  let best = loserWp(marginAt(r.tl, 720), 720);
  for (const [period, left, h, a] of r.tl) {
    if (period === 4 && left > 360) best = Math.max(best, loserWp(h - a, left));
  }
  return best;
}

function doubtInQ4(rows: Row[], mu: number, sigma: number): void {
  console.log('\n=== 6. The doubt in the fourth instead of the comeback door ===');
  for (const x of [0.2, 0.25, 0.33, 0.4]) {
    const deficits = [720, 540, 420].map((left) => {
      let m = 0;
      while (Math.min(wpHome(-(m + 1), left / GAME, mu, sigma), 1 - wpHome(m + 1, left / GAME, mu, sigma)) >= x) m++;
      return `${clock(left)} down ${m}`;
    });
    console.log(`  ${Math.round(100 * x)}%: ${deficits.join(' · ')} (or less)`);
  }
  const before6 = rows.map((r) => bestBefore6(r, mu, sigma));
  const after6 = rows.map((r) => netOf(r, mu, sigma).best);
  const otherDoors = (g: Row['g']) => closeFinalMargin(g) || closeByClutch(g)
    || (g.late !== undefined && (g.late.clutchSeconds > 0 || (g.late.marginAt6 !== undefined && g.late.marginAt6 <= SCORING.disputed.maxMarginAt6)));
  const rate = (r: Row, close: boolean) => {
    const pts = competitivenessPoints(r.g) + performancePoints(r.g);
    return Math.min(100, Math.round(close ? SCORING.disputedBase + pts : Math.min(SCORING.blowoutMax, pts)));
  };
  const seasons = new Set(rows.map((r) => r.season)).size;
  const base = rows.map((r) => isDisputed(r.g));
  const q3 = (r: Row) => { const s = marginAt(r.tl, 720); return r.homeWon ? s : -s; };
  const fmt = (i: number, after: number) => {
    const r = rows[i]!;
    return `    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(after).padStart(3)}   loser's best before 6:00 ${(100 * before6[i]!).toFixed(0).padStart(2)}% · after 6:00 ${(100 * after6[i]!).toFixed(0).padStart(2)}% · winner after Q3 ${String(q3(r)).padStart(3)}, at 6:00 ${String(Math.abs(marginAt(r.tl, 360))).padStart(2)} · loser led by ${String(loserBiggestLead(r.g)).padStart(2)} · ${story(r)}`;
  };
  console.log(`\n  ${'variant'.padEnd(36)} close   50%+    in   out   (per season)`);
  console.log(`  ${'today'.padEnd(36)} ${`${((100 * base.filter(Boolean).length) / rows.length).toFixed(1)}%`.padStart(5)} ${`${((100 * rows.filter((r) => r.note >= 50).length) / rows.length).toFixed(1)}%`.padStart(6)}`);
  const results = [0.2, 0.25, 0.33, 0.4].map((x) => {
    const close = rows.map((r, i) => otherDoors(r.g) || after6[i]! >= 0.1 || before6[i]! >= x);
    const notes = rows.map((r, i) => rate(r, close[i]!));
    const ins = rows.map((_, i) => i).filter((i) => close[i] && !base[i]);
    const outs = rows.map((_, i) => i).filter((i) => !close[i] && base[i]);
    const label = `net 10% + doubt in Q4 ${Math.round(100 * x)}%`;
    console.log(`  ${label.padEnd(36)} ${`${((100 * close.filter(Boolean).length) / rows.length).toFixed(1)}%`.padStart(5)} ${`${((100 * notes.filter((n) => n >= 50).length) / rows.length).toFixed(1)}%`.padStart(6)} ${String(ins.length).padStart(5)} ${String(outs.length).padStart(5)}   (${(ins.length / seasons).toFixed(1)} in, ${(outs.length / seasons).toFixed(1)} out)`);
    return { label, ins, outs, notes };
  });
  for (const v of results) {
    const ins = [...v.ins].sort((a, b) => before6[a]! - before6[b]!);
    console.log(`\n  ${v.label}: in (${ins.length}), the weakest doubt first (first 20), then the strongest (last 5)`);
    for (const i of ins.slice(0, 20)) console.log(fmt(i, v.notes[i]!));
    if (ins.length > 20) { console.log('    …'); for (const i of ins.slice(-5)) console.log(fmt(i, v.notes[i]!)); }
    const outs = [...v.outs].sort((a, b) => before6[b]! - before6[a]!);
    console.log(`  ${v.label}: out (${outs.length}), the most doubt first (first 20), then the least (last 5)`);
    for (const i of outs.slice(0, 20)) console.log(fmt(i, v.notes[i]!));
    if (outs.length > 20) { console.log('    …'); for (const i of outs.slice(-5)) console.log(fmt(i, v.notes[i]!)); }
  }
}

// November 10: the spicy rocks with the doubt in the fourth at 33% and the 10% net. A rock needs a close
// game: the games out lose theirs, the games in may win one (the other gates unchanged).
function rocksWithDoubt(rows: Row[], mu: number, sigma: number): void {
  console.log('\n=== 7. The spicy rocks with the doubt in the fourth (33%) and the net (10%) ===');
  const otherDoors = (g: Row['g']) => closeFinalMargin(g) || closeByClutch(g)
    || (g.late !== undefined && (g.late.clutchSeconds > 0 || (g.late.marginAt6 !== undefined && g.late.marginAt6 <= SCORING.disputed.maxMarginAt6)));
  const forced = (g: Row['g']): Row['g'] => ({ ...g, late: { ...(g.late ?? { clutchSeconds: 0, marginAt2: 99, weightedSwings: 0 }), clutchSeconds: Math.max(1, g.late?.clutchSeconds ?? 0) } });
  const star = (p: PlayerLine) => `${p.name ?? '?'} ${p.pts} pts, eff ${efficiency(p)}`;
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  const lost: Row[] = [];
  const won: Row[] = [];
  let today = 0;
  let after = 0;
  for (const r of rows) {
    const close = otherDoors(r.g) || netOf(r, mu, sigma).best >= 0.1 || bestBefore6(r, mu, sigma) >= 0.33;
    const rockToday = Boolean(whyOf(r.g)?.nuclear);
    const rockAfter = close && Boolean(whyOf(forced(r.g))?.nuclear);
    if (rockToday) today++;
    if (rockAfter) after++;
    if (rockToday && !rockAfter) lost.push(r);
    if (!rockToday && rockAfter) won.push(r);
  }
  console.log(`  rocks: ${today} today → ${after} (${(today / seasons.length).toFixed(1)} → ${(after / seasons.length).toFixed(1)} per season)`);
  console.log(`  per season, lost / won: ${seasons.map((s) => `${s} ${lost.filter((r) => r.season === s).length}/${won.filter((r) => r.season === s).length}`).join(' · ')}`);
  const show = (r: Row) => {
    const best = [...r.g.players].sort((a, b) => Math.max(efficiency(b), b.pts) - Math.max(efficiency(a), a.pts))[0]!;
    const before = bestBefore6(r, mu, sigma), late = netOf(r, mu, sigma);
    return `    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} rated ${String(r.note).padStart(3)} · ${star(best)} · loser's best before 6:00 ${(100 * before).toFixed(0)}%, after ${(100 * late.best).toFixed(0)}% · lead at 6:00 ${late.lead6} · loser led by ${loserBiggestLead(r.g)} · ${story(r)}`;
  };
  console.log(`\n  rocks lost (${lost.length}):`);
  for (const r of lost) console.log(show(r));
  console.log(`\n  rocks won (${won.length}):`);
  for (const r of won) console.log(show(r));
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') throw new Error('wp-study prints games and how the rating behaves: never on GitHub Actions (public logs).');
  const seasons = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}$/.test(a));
  if (seasons.length === 0) throw new Error('Usage: npm run wp-study -- 2025-26 [2024-25 …]');
  loadScoring();
  loadPeaks();

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

  safetyNet(rows, mu, sigma);
  netAndComeback(rows, mu, sigma);
  doubtInQ4(rows, mu, sigma);
  rocksWithDoubt(rows, mu, sigma);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
