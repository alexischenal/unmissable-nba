// scripts/flame-study.ts
// Where should the flame start? A whole season of box scores, read at several efficiency thresholds:
// how often the flame shows, on which games, for whom, and what a night just at the threshold looks like.
// Local only: it prints player names and how the settings behave (the logs of a public repo are public).
//
// Usage (after npm run season-stats -- 2025-26 --clutch, which fills .cache/):
//   npm run flame-study -- 2025-26            → the study, focused on the current bigNight threshold
//   npm run flame-study -- 2025-26 --at 40    → the same, focused on 40
//   npm run flame-study -- 2025-26 --player "Stephen Curry"   → also that player's biggest scoring nights
//
// The nights are grouped by the UTC date of the game (all the cache keeps): close to the real nights,
// not exact (a 1 p.m. Sunday game and the Saturday night games share a date).

import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lateFrom, swings, type Timeline } from './nba/clutch.ts';
import { firstThreeQuarters, type PeriodStats } from './nba/periodStats.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import {
  closeByClutch, closeFinalMargin, competitivenessPoints, disputedBaseFor, displayScore, efficiency, isDisputed, loserBiggestLead,
  marginAfterQ3, performancePoints,
} from '../src/lib/scoring.ts';
import type { Game, PlayerLine } from '../src/types/game.ts';
import { whyOf } from '../src/lib/why.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
type CachedGame = Game & { id: string; date?: string };
type Row = { g: CachedGame; season: string; note: number; effs: number[]; best: number; maxPts: number; tl?: Timeline };

// The flame at an efficiency threshold, with the points rule of the big nights (src/lib/why.ts)
const litLine = (p: PlayerLine, at: number) => efficiency(p) >= at || p.pts >= SCORING.why.bigPoints;
const litGame = (r: Row, at: number) => r.best >= at || r.maxPts >= SCORING.why.bigPoints;

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
    const lit = (r: Row) => litGame(r, t);
    const empty = [...nights.values()].filter((games) => !games.some(lit)).length;
    const perNight = rows.filter(lit).length / nights.size;
    console.log(
      `  ${String(t).padStart(5)}   ${pct(rows.filter(lit).length, rows.length).padStart(5)}   ${n1(perNight).padStart(9)}   ` +
      `${pct(empty, nights.size).padStart(10)}   ${pct(rows.filter((r) => r.g.players.filter((p) => litLine(p, t)).length >= 2).length, rows.length).padStart(9)}   ` +
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
    const lit = games.filter((r) => litGame(r, at)).length;
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
      if (r.g.players.some((p) => teamOf(r.g, p) === abbr && litLine(p, at))) t.lit++;
      teams.set(abbr, t);
    }
    for (const p of r.g.players) {
      if (!p.name) continue;
      const x = players.get(p.name) ?? { team: teamOf(r.g, p), lit: 0, games: 0 };
      x.games++;
      if (litLine(p, at)) x.lit++;
      players.set(p.name, x);
    }
  }
  const litLines = rows.reduce((s, r) => s + r.g.players.filter((p) => litLine(p, at)).length, 0);
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

// The big scoring nights the efficiency leaves out: a player who had to shoot a lot to carry his team
function scoringNights(rows: Row[], at: number): void {
  title(`Big scoring nights and the efficiency at ${at}+ alone (without the ${SCORING.why.bigPoints}-point rule)`);
  const lines = rows.flatMap((r) => r.g.players.map((p) => ({ r, p, e: efficiency(p) })));
  for (const min of [35, 40, 45, 50]) {
    const x = lines.filter((l) => l.p.pts >= min);
    console.log(`  ${min}+ points: ${String(x.length).padStart(3)} lines, ${pct(x.filter((l) => l.e >= at).length, x.length).padStart(4)} with the flame`);
  }
  const missed = lines.filter((l) => l.p.pts >= 40 && l.e < at).sort((a, b) => b.p.pts - a.p.pts);
  console.log(`  40+ points under ${at} of efficiency (${missed.length}):`);
  for (const l of missed.slice(0, 25)) {
    console.log(`    ${(l.p.name ?? '?').padEnd(24)} eff ${String(l.e).padStart(2)}  ${line(l.p)}   game ${l.r.note}%`);
  }
}

function playerNights(rows: Row[], name: string, at: number): void {
  title(`${name}: his biggest scoring nights`);
  const lines = rows.flatMap((r) => r.g.players.filter((p) => p.name === name).map((p) => ({ r, p, e: efficiency(p) })));
  if (lines.length === 0) {
    console.log('  no game found under this name (check the spelling, accents included)');
    return;
  }
  console.log(`  ${lines.length} games, ${lines.filter((l) => litLine(l.p, at)).length} with the flame at ${at}+`);
  for (const l of [...lines].sort((a, b) => b.p.pts - a.p.pts).slice(0, 12)) {
    console.log(`    ${litLine(l.p, at) ? 'flame' : '     '}  eff ${String(l.e).padStart(2)}  ${line(l.p)}   game ${l.r.note}%`);
  }
}

// The hidden level: how often would a historic night show? Points, efficiency, quadruple-doubles.
function nuclearReport(rows: Row[]): void {
  title('Historic nights (the hidden nuclear level)');
  const lines = rows.flatMap((r) => r.g.players.map((p) => ({ r, p, e: efficiency(p) })));
  const quad = (p: PlayerLine) => [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length >= 4;
  for (const n of [50, 55, 60, 65, 70]) console.log(`  ${n}+ points: ${lines.filter((l) => l.p.pts >= n).length}`);
  for (const n of [60, 65, 68, 70, 75]) console.log(`  efficiency ${n}+: ${lines.filter((l) => l.e >= n).length}`);
  console.log(`  quadruple-doubles: ${lines.filter((l) => quad(l.p)).length}`);
  // Scoring duels: two players (or more) at 40, 45, 50 points in the same game
  for (const n of [40, 45, 50]) {
    const duels = rows.filter((r) => r.g.players.filter((p) => p.pts >= n).length >= 2);
    console.log(`  games with 2+ players at ${n}+ points: ${duels.length}`);
    if (n >= 45) {
      for (const r of duels) {
        const best = r.g.players.filter((p) => p.pts >= n).map((p) => `${p.name ?? '?'} ${p.pts} pts (eff ${efficiency(p)})`).join(' · ');
        console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} game ${String(r.note).padStart(3)}%   ${best}`);
      }
    }
  }
  // Duels: two players (or more) at a high efficiency in the same game
  for (const n of [45, 50, 55]) {
    const duels = rows.filter((r) => r.effs.filter((e) => e >= n).length >= 2);
    console.log(`  games with 2+ players at ${n}+ efficiency: ${duels.length}`);
    if (n >= 50) {
      for (const r of duels) {
        const best = r.g.players.filter((p) => efficiency(p) >= n).map((p) => `${p.name ?? '?'} ${efficiency(p)} (${p.pts} pts)`).join(' · ');
        console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} game ${String(r.note).padStart(3)}%   ${best}`);
      }
    }
  }
  const top = lines.filter((l) => l.p.pts >= 55 || l.e >= 65 || quad(l.p)).sort((a, b) => b.e - a.e);
  console.log(`  the nights at 55+ points, 65+ efficiency or a quadruple-double (${top.length}):`);
  for (const l of top) console.log(`    ${(l.r.g.date ?? '').padEnd(10)} ${(l.p.name ?? '?').padEnd(24)} eff ${String(l.e).padStart(2)}  ${line(l.p)}   game ${l.r.note}%`);
}

// The nuclear level with the settings in use (src/lib/why.ts): every night it would have shown, per season
function nuclearNights(rows: Row[]): void {
  title('The radioactive button with the current settings');
  const bySeason = new Map<string, Row[]>();
  for (const r of rows) {
    if (!whyOf(r.g)?.nuclear) continue;
    bySeason.set(r.season, [...(bySeason.get(r.season) ?? []), r]);
  }
  for (const season of [...new Set(rows.map((r) => r.season))].sort()) {
    const games = (bySeason.get(season) ?? []).sort((a, b) => (a.g.date ?? '').localeCompare(b.g.date ?? ''));
    console.log(`  ${season}: ${games.length}`);
    for (const r of games) {
      const who = r.g.players.filter((p) => efficiency(p) >= 45 || p.pts >= 45).map((p) => `${p.name ?? '?'} ${p.pts} pts eff ${efficiency(p)}`).join(' · ');
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} game ${String(r.note).padStart(3)}%   ${who}`);
    }
  }
}

// The spicy rock variants. Since November 5 it needs a competitive game (50%+) and a duel mixes the two
// doors (each player at nuclearDuel efficiency or nuclearDuelPoints points). The nights the 50%+
// condition drops, told from the play-by-play: were they really decided early?
const quad = (p: PlayerLine) => [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length >= 4;
const soloRock = (p: PlayerLine) => p.pts >= SCORING.why.nuclearPoints || efficiency(p) >= SCORING.why.nuclearEff || quad(p)
  || (p.fg3m ?? 0) >= SCORING.why.nuclearThrees;
const duelist = (p: PlayerLine) => efficiency(p) >= SCORING.why.nuclearDuel || p.pts >= SCORING.why.nuclearDuelPoints;
const mixedDuel = (g: Game) => g.players.filter(duelist).length >= 2;
const pureDuel = (g: Game) => g.players.filter((p) => efficiency(p) >= SCORING.why.nuclearDuel).length >= 2
  || g.players.filter((p) => p.pts >= SCORING.why.nuclearDuelPoints).length >= 2;

// Home minus away when a given time is reached in Q4 (secondsLeft), from the timeline
function marginInQ4(tl: Timeline, secondsLeft: number): number {
  let m = 0;
  for (const [period, s, h, a] of tl) {
    if (period < 4 || (period === 4 && s > secondsLeft)) m = h - a;
  }
  return m;
}

// Points scored in Q4 and overtimes by a player, from the scorers of the timeline
function q4Points(tl: Timeline, id: number | undefined): number | null {
  if (id === undefined || !tl.some((e) => e[4] !== undefined)) return null;
  let pts = 0, h0 = 0, a0 = 0;
  for (const [period, , h, a, scorer] of tl) {
    if (period >= 4 && scorer === id) pts += (h - h0) + (a - a0);
    h0 = h; a0 = a;
  }
  return pts;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function blowoutStory(r: Row): string {
  const g = r.g;
  let h = 0, a = 0;
  const quarters = g.periods.map((p, i) => { h += p.home; a += p.away; return `${i < 4 ? `Q${i + 1}` : `OT${i - 3}`} ${signed(h - a)}`; }).join(' ');
  const out = [`${g.home} margin: ${quarters}`];
  const f = h > a ? g.biggestLead.away : g.biggestLead.home;
  out.push(`loser led by ${f}`);
  if (r.tl) {
    out.push(`at 6:00 ${signed(marginInQ4(r.tl, 360))} · at 2:00 ${signed(marginInQ4(r.tl, 120))}`);
    out.push(`${swings(r.tl).filter((s) => s.kind === 'change').length} lead changes`);
  }
  return out.join(' · ');
}

function rockVariants(rows: Row[]): void {
  title('Spicy rock variants');
  const variants: [string, (r: Row) => boolean][] = [
    ['rule in use (50%+ only)', (r) => !!whyOf(r.g)?.nuclear],
    ['same doors, any rating', (r) => r.g.players.some(soloRock) || mixedDuel(r.g)],
    ['before Nov 5 (any rating)', (r) => r.g.players.some(soloRock) || pureDuel(r.g)],
  ];
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  console.log(`  ${'variant'.padEnd(30)} ${seasons.map((s) => s.padStart(8)).join('')}   total   per season   share of games`);
  for (const [label, test] of variants) {
    const per = seasons.map((s) => rows.filter((r) => r.season === s && test(r)).length);
    const total = per.reduce((x, y) => x + y, 0);
    console.log(`  ${label.padEnd(30)} ${per.map((n) => String(n).padStart(8)).join('')}   ${String(total).padStart(5)}   ${(total / seasons.length).toFixed(1).padStart(10)}   ${((100 * total) / rows.length).toFixed(2)}%`);
  }

  const who = (g: Game) => g.players.filter((p) => soloRock(p) || duelist(p))
    .map((p) => `${p.name ?? '?'} ${p.pts} pts eff ${efficiency(p)}${soloRock(p) ? '' : ' (duel)'}`).join(' · ');
  const byDate = (a: Row, b: Row) => (a.g.date ?? '').localeCompare(b.g.date ?? '');

  const added = rows.filter((r) => mixedDuel(r.g) && !pureDuel(r.g) && !r.g.players.some(soloRock)).sort(byDate);
  console.log(`\n  games the mixed duel adds (${added.length}):`);
  for (const r of added) console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} game ${String(r.note).padStart(3)}%   ${who(r.g)}`);

  const lost = rows.filter((r) => (r.g.players.some(soloRock) || mixedDuel(r.g)) && r.note < 50).sort(byDate);
  console.log(`\n  rock nights under 50%, the ones the 50%+ condition drops (${lost.length}): were they decided early?`);
  for (const r of lost) {
    console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} game ${String(r.note).padStart(3)}%   ${who(r.g)}`);
    console.log(`      ${blowoutStory(r)}`);
    const stars = r.g.players.filter((p) => soloRock(p) || duelist(p))
      .map((p) => { const q4 = q4Points(r.tl ?? [], p.id); return q4 === null ? null : `${p.name ?? '?'} ${q4} pts in Q4/OT`; })
      .filter(Boolean);
    if (stars.length) console.log(`      ${stars.join(' · ')}`);
  }
}

// Buzzer beaters: the last basket of Q4 or of an overtime, made at the very end (the ball goes in after
// the clock ran out), that wins the game or ties it to force overtime. Rule idea (November 5): a big
// performance (a flame) plus a buzzer beater is a spicy rock. How does the NBA log those shots: exactly
// 0.0, or a few tenths? So several windows. Free throws (1 point, logged at 0.0 after a foul at the
// buzzer) are left out: a basket is 2 or 3 points.
type Buzzer = { r: Row; period: number; left: number; pts: number; kind: 'win' | 'tie'; shooter?: PlayerLine };

function buzzersOf(r: Row): Buzzer[] {
  const tl = r.tl;
  if (!tl || !tl.some((e) => e[4] !== undefined)) return [];
  const out: Buzzer[] = [];
  const last = r.g.periods.length;
  for (let period = 4; period <= last; period++) {
    const inPeriod = tl.filter((e) => e[0] === period);
    const end = inPeriod.at(-1);
    if (!end) continue;
    const i = tl.indexOf(end);
    const [, left, h, a, scorer] = end;
    const [, , h0, a0] = i > 0 ? tl[i - 1]! : [0, 0, 0, 0];
    const pts = (h - h0) + (a - a0);
    if (pts < 2 || left > 3) continue;
    const home = h > h0;
    const before = home ? h0 - a0 : a0 - h0; // the scoring team's margin before the basket
    const after = home ? h - a : a - h;
    if (before > 0) continue; // already ahead: not a game-changing basket
    const kind = period === last && after > 0 ? 'win' : period < last && after === 0 ? 'tie' : null;
    if (!kind) continue;
    out.push({ r, period, left, pts, kind, shooter: r.g.players.find((p) => p.id !== undefined && p.id === scorer) });
  }
  return out;
}

function buzzerBeaters(rows: Row[]): void {
  title('Buzzer beaters (a big performance + a buzzer beater = a spicy rock?)');
  const withScorers = rows.filter((r) => r.tl?.some((e) => e[4] !== undefined)).length;
  console.log(`  ${withScorers} of ${rows.length} games have the scorers in their play-by-play`);
  const all = rows.flatMap(buzzersOf);
  const lit = (b: Buzzer) => b.shooter !== undefined && litLine(b.shooter, SCORING.why.bigNight);
  const windows: [string, number][] = [['exactly 0.0', 0], ['0.5 s or less', 0.5], ['1 s or less', 1], ['3 s or less', 3]];
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  console.log(`  ${'time left'.padEnd(15)} ${'wins'.padStart(5)} ${'ties'.padStart(5)}   shooter with a flame   new rocks (not already one, game 50%+)   per season`);
  for (const [label, max] of windows) {
    const bs = all.filter((b) => b.left <= max);
    const flame = bs.filter(lit);
    const fresh = flame.filter((b) => !whyOf(b.r.g)?.nuclear && b.r.note > SCORING.blowoutMax);
    console.log(`  ${label.padEnd(15)} ${String(bs.filter((b) => b.kind === 'win').length).padStart(5)} ${String(bs.filter((b) => b.kind === 'tie').length).padStart(5)}   ${String(flame.length).padStart(20)}   ${String(fresh.length).padStart(39)}   ${(fresh.length / seasons.length).toFixed(1).padStart(10)}`);
  }
  const unknown = all.filter((b) => !b.shooter).length;
  if (unknown) console.log(`  (${unknown} shot(s) whose scorer isn't in the box score)`);

  console.log('\n  every one at 3 s or less, closest to the buzzer first:');
  for (const b of [...all].sort((x, y) => x.left - y.left || (x.r.g.date ?? '').localeCompare(y.r.g.date ?? ''))) {
    const p = b.shooter;
    const who = p ? `${(p.name ?? '?').padEnd(24)} ${String(p.pts).padStart(2)} pts eff ${String(efficiency(p)).padStart(2)}${lit(b) ? ' 🔥' : '   '}` : '?'.padEnd(43);
    const where = b.period <= 4 ? 'Q4' : `OT${b.period - 4}`;
    console.log(`    ${(b.r.g.date ?? '').padEnd(10)} ${`${b.r.g.away}@${b.r.g.home}`.padEnd(8)} ${where.padEnd(3)} ${b.left.toFixed(1).padStart(4)} s  ${b.pts}-pt ${b.kind === 'win' ? 'winner' : 'tie   '}  ${who}  game ${String(b.r.note).padStart(3)}%${whyOf(b.r.g)?.nuclear ? ' (already a rock)' : ''}`);
  }
}

// A door relative to the player (November 5): a night in his own top, from his games of the seasons
// before (as the site will do it: thresholds computed once a season, from the past only), above an
// absolute floor, in a competitive game. On efficiency (floor: huge) or on points (floor: a few values).
// Only the target seasons that have at least one season before them in the cache.
const played = (p: PlayerLine) => p.pts + p.reb + p.ast + p.stl + p.blk + p.fga + p.fta + p.tov > 0;

function personalPeaks(rows: Row[]): void {
  title('Personal peaks (a door relative to the player)');
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  const targets = seasons.slice(1);
  if (targets.length === 0) { console.log('  needs at least two seasons'); return; }
  const MIN_GAMES = 60;
  type Line = { p: PlayerLine; r: Row; e: number };
  const linesOf = (season: string): Line[] => rows.filter((r) => r.season === season)
    .flatMap((r) => r.g.players.filter((p) => p.id !== undefined && played(p)).map((p) => ({ p, r, e: efficiency(p) })));
  const bySeason = new Map(seasons.map((s) => [s, linesOf(s)]));
  const names = new Map<number, string>();
  for (const ls of bySeason.values()) for (const l of ls) if (l.p.name) names.set(l.p.id!, l.p.name);

  // The thresholds of a target season: every game of the seasons before it
  type Peaks = { games: number; effs: number[]; pts: number[] };
  const peaksFor = (target: string) => {
    const m = new Map<number, Peaks>();
    for (const s of seasons.filter((x) => x < target)) {
      for (const l of bySeason.get(s)!) {
        const k = m.get(l.p.id!) ?? { games: 0, effs: [], pts: [] };
        k.games++; k.effs.push(l.e); k.pts.push(l.p.pts);
        m.set(l.p.id!, k);
      }
    }
    for (const k of m.values()) { k.effs.sort((a, b) => a - b); k.pts.sort((a, b) => a - b); }
    return m;
  };
  const peaks = new Map(targets.map((t) => [t, peaksFor(t)]));

  // A variant: where his personal bar is (record, or a top share of his games), and the absolute floors
  type Variant = { label: string; bar: (xs: number[]) => number; strict: boolean; effFloor: number; ptsFloor: number };
  const record = (xs: number[]) => xs[xs.length - 1]!;
  const top = (share: number) => (xs: number[]) => xs[Math.max(0, Math.ceil(xs.length * (1 - share)) - 1)]!;
  const huge = SCORING.why.hugeNight;
  const variants: Variant[] = [];
  for (const ptsFloor of [40, 45]) {
    variants.push({ label: `record (beat it), pts ≥ ${ptsFloor}`, bar: record, strict: true, effFloor: huge, ptsFloor });
    variants.push({ label: `top 0.5%, pts ≥ ${ptsFloor}`, bar: top(0.005), strict: false, effFloor: huge, ptsFloor });
    variants.push({ label: `top 1%, pts ≥ ${ptsFloor}`, bar: top(0.01), strict: false, effFloor: huge, ptsFloor });
    variants.push({ label: `top 2%, pts ≥ ${ptsFloor}`, bar: top(0.02), strict: false, effFloor: huge, ptsFloor });
  }
  // A higher floor: crazy efficiency, or 50 points. Only the very big nights, when they're also his peak.
  const crazy = SCORING.why.crazyNight;
  variants.push({ label: `top 1%, eff ≥ ${crazy} / pts ≥ 50`, bar: top(0.01), strict: false, effFloor: crazy, ptsFloor: 50 });
  // His top 1% between the huge and the crazy floors: a grid to choose how often
  for (const effFloor of [50, crazy]) {
    for (const ptsFloor of [45, 48, 50]) {
      if (effFloor === crazy && ptsFloor === 50) continue; // already above
      variants.push({ label: `top 1%, eff ≥ ${effFloor} / pts ≥ ${ptsFloor}`, bar: top(0.01), strict: false, effFloor, ptsFloor });
    }
  }

  const hits = (v: Variant): (Line & { via: string })[] => targets.flatMap((t) => bySeason.get(t)!.flatMap((l) => {
    const k = peaks.get(t)!.get(l.p.id!);
    if (!k || k.games < MIN_GAMES || l.r.note <= SCORING.blowoutMax || whyOf(l.r.g)?.nuclear) return [];
    const beats = (x: number, bar: number) => (v.strict ? x > bar : x >= bar);
    const viaEff = l.e >= v.effFloor && beats(l.e, v.bar(k.effs));
    const viaPts = l.p.pts >= v.ptsFloor && beats(l.p.pts, v.bar(k.pts));
    return viaEff || viaPts ? [{ ...l, via: viaEff && viaPts ? 'eff+pts' : viaEff ? 'eff' : 'pts' }] : [];
  }));

  console.log(`  thresholds from the seasons before each target (${targets.join(', ')}), at least ${MIN_GAMES} games played; efficiency floor ${huge} (huge); game 50%+; not already a rock`);
  console.log(`  ${'variant'.padEnd(30)} ${targets.map((t) => t.padStart(8)).join('')}   per season   players   most rocks`);
  const all = variants.map((v) => ({ v, h: hits(v) }));
  for (const { v, h } of all) {
    const per = targets.map((t) => h.filter((x) => x.r.season === t).length);
    const count = new Map<number, number>();
    for (const x of h) count.set(x.p.id!, (count.get(x.p.id!) ?? 0) + 1);
    const most = [...count].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => `${names.get(id) ?? id} ${n}`).join(' · ');
    console.log(`  ${v.label.padEnd(30)} ${per.map((n) => String(n).padStart(8)).join('')}   ${(h.length / targets.length).toFixed(1).padStart(10)}   ${String(count.size).padStart(7)}   ${most}`);
  }

  for (const { v, h } of all.filter(({ v }) => v.label === `top 1%, eff ≥ ${crazy} / pts ≥ 45`)) {
    console.log(`\n  ${v.label}: the ${h.length} nights`);
    for (const x of [...h].sort((a, b) => (a.r.g.date ?? '').localeCompare(b.r.g.date ?? ''))) {
      const k = peaks.get(x.r.season)!.get(x.p.id!)!;
      console.log(`    ${(x.r.g.date ?? '').padEnd(10)} ${(x.p.name ?? '?').padEnd(24)} ${line(x.p)}   eff ${String(x.e).padStart(2)} (bar ${v.bar(k.effs)}) pts bar ${v.bar(k.pts)} · ${x.via} · ${k.games} games before · game ${x.r.note}%`);
    }
  }
}

// Season by season, as the cards would show it with every rule in use: the cards by their hottest level,
// and the spicy rocks by door. The personal door is simulated like the site runs it: each player's top 1%
// from the seasons before (60 games minimum), with the floors of player-peaks.secret.json (no file: no
// personal door here). A game can open several doors: counted under each.
function seasonSummary(rows: Row[]): void {
  title('Season by season: the flames and the spicy rocks');
  const file = path.join(ROOT, 'player-peaks.secret.json');
  const floors = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as { eff: number; pts: number } : null;
  if (!floors) console.log('  (no player-peaks.secret.json: no personal door below)');
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  const top = (xs: number[]) => { const t = [...xs].sort((a, b) => a - b); return t[Math.max(0, Math.ceil(t.length * 0.99) - 1)]!; };
  const history = new Map<number, { eff: number[]; pts: number[] }>();
  const w = SCORING.why;
  console.log(`  ${'season'.padEnd(8)} ${'games'.padStart(5)}  ${'flame'.padStart(5)}   big  huge crazy  rock │ rocks by door: 60 pts  eff  quad  duel  buzzer  threes  3 QT  personal`);
  for (const season of seasons) {
    const rs = rows.filter((r) => r.season === season);
    // The bars of this season: every game before it
    const bars = new Map<number, { eff: number; pts: number }>();
    for (const [id, h] of history) if (h.eff.length >= 60) bars.set(id, { eff: top(h.eff), pts: top(h.pts) });
    const c = { flame: 0, big: 0, huge: 0, crazy: 0, rock: 0, pts: 0, eff: 0, quad: 0, duel: 0, buzzer: 0, threes: 0, q3: 0, personal: 0 };
    for (const r of rs) {
      const why = whyOf(r.g);
      const competitive = r.note > SCORING.blowoutMax;
      const personal = !!floors && competitive && r.g.players.some((p) => {
        const b = p.id !== undefined ? bars.get(p.id) : undefined;
        const e = efficiency(p);
        return !!b && ((e >= floors.eff && e >= b.eff) || (p.pts >= floors.pts && p.pts >= b.pts));
      });
      if (why?.nuclear || personal) {
        c.rock++;
        // The blowout door: any game, a winner's line over the first three quarters
        if (r.g.players.some((p) => {
          const q = p.id !== undefined ? r.g.late?.firstThree?.find((x) => x.id === p.id) : undefined;
          return !!q && (q.pts >= w.blowoutPoints || q.eff >= w.blowoutEff);
        })) c.q3++;
        if (competitive) {
          if (r.g.players.some((p) => p.pts >= w.nuclearPoints)) c.pts++;
          if (r.g.players.some((p) => efficiency(p) >= w.nuclearEff)) c.eff++;
          if (r.g.players.some(quad)) c.quad++;
          if (mixedDuel(r.g)) c.duel++;
          const shooter = r.g.players.find((p) => p.id !== undefined && p.id === r.g.late?.buzzerBeater);
          if (shooter && (efficiency(shooter) >= w.bigNight || shooter.pts >= w.bigPoints)) c.buzzer++;
          if (r.g.players.some((p) => (p.fg3m ?? 0) >= w.nuclearThrees)) c.threes++;
          if (personal) c.personal++;
        }
      } else if (why?.crazy) c.crazy++;
      else if (why?.huge) c.huge++;
      else if (why?.big) c.big++;
      if (why || personal) c.flame++;
    }
    const pc = (n: number) => `${String(n).padStart(4)}`;
    console.log(`  ${season.padEnd(8)} ${String(rs.length).padStart(5)}  ${pct(c.flame, rs.length).padStart(5)}  ${pc(c.big)}  ${pc(c.huge)}  ${pc(c.crazy)}  ${pc(c.rock)} │ ${' '.repeat(14)}${pc(c.pts)} ${pc(c.eff)}  ${pc(c.quad)}  ${pc(c.duel)}  ${pc(c.buzzer).padStart(6)}  ${pc(c.threes).padStart(6)}  ${pc(c.q3)}  ${floors ? pc(c.personal).padStart(8) : '       -'}`);
    // Then this season joins the history of the next ones
    for (const r of rs) for (const p of r.g.players) {
      if (p.id === undefined || !played(p)) continue;
      const h = history.get(p.id) ?? { eff: [], pts: [] };
      h.eff.push(efficiency(p)); h.pts.push(p.pts);
      history.set(p.id, h);
    }
  }
  console.log('  (cards counted once, by their hottest level; "rock" includes the personal door; a rock can open several doors;');
  console.log('   "3 QT": the blowout door, counted only where the period stats are downloaded)');
}

// Threes (November 5): a door for the nights efficiency doesn't see, the shooter's kind (Curry's).
// How many lines at 10+, 11+, 12+, 13+ threes made; with the rules in use, which of them would already
// be a rock (the personal door simulated as in the season summary is not counted here: whyOf only).
function threesNights(rows: Row[]): void {
  title('Threes made (a door for the shooters?)');
  const lines = rows.flatMap((r) => r.g.players.filter((p) => p.fg3m !== undefined).map((p) => ({ p, r })));
  const withThrees = new Set(lines.map((l) => l.r)).size;
  console.log(`  ${withThrees} of ${rows.length} games have the threes made in their box score`);
  for (const n of [10, 11, 12, 13]) {
    const at = lines.filter((l) => l.p.fg3m! >= n);
    const competitive = at.filter((l) => l.r.note > SCORING.blowoutMax);
    const fresh = competitive.filter((l) => !whyOf(l.r.g)?.nuclear);
    console.log(`  ${n}+ threes: ${String(at.length).padStart(3)} lines · in a 50%+ game ${String(competitive.length).padStart(3)} · not already a rock (absolute doors) ${String(fresh.length).padStart(3)}`);
  }
  console.log('\n  every night at 10+ threes:');
  for (const l of lines.filter((x) => x.p.fg3m! >= 10).sort((a, b) => b.p.fg3m! - a.p.fg3m! || (a.r.g.date ?? '').localeCompare(b.r.g.date ?? ''))) {
    console.log(`    ${(l.r.g.date ?? '').padEnd(10)} ${(l.p.name ?? '?').padEnd(24)} ${String(l.p.fg3m).padStart(2)} threes · ${line(l.p)} · eff ${efficiency(l.p)}   game ${String(l.r.note).padStart(3)}%${whyOf(l.r.g)?.nuclear ? ' (already a rock)' : ''}`);
  }
}

// The window of the personal door (November 5): all the history, or only his recent level? With all of
// it, a player past his prime is compared with his prime (and never gets there again), a rising player
// with his weaker years. Each window, as the site would run it (bars from before the season, fixed for
// it), with the floors of player-peaks.secret.json; only the personal door, in 50%+ games, not already a
// rock through another door.
function peakWindows(rows: Row[]): void {
  title('Personal door: the window of the history');
  const file = path.join(ROOT, 'player-peaks.secret.json');
  if (!existsSync(file)) { console.log('  needs player-peaks.secret.json (the floors)'); return; }
  const floors = JSON.parse(readFileSync(file, 'utf8')) as { eff: number; pts: number };
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  const targets = seasons.slice(2);
  const top = (xs: number[]) => { const t = [...xs].sort((a, b) => a - b); return t[Math.max(0, Math.ceil(t.length * 0.99) - 1)]!; };
  type Past = { season: string; eff: number; pts: number };
  // Every player's games, in order
  const ordered = [...rows].sort((a, b) => a.season.localeCompare(b.season) || (a.g.date ?? '').localeCompare(b.g.date ?? ''));
  type Window = { label: string; keep: (past: Past[], target: string) => Past[] };
  const windows: Window[] = [
    { label: 'all the history', keep: (past) => past },
    { label: 'last 3 seasons', keep: (past, t) => past.filter((x) => seasons.indexOf(t) - seasons.indexOf(x.season) <= 3) },
    { label: 'last 2 seasons', keep: (past, t) => past.filter((x) => seasons.indexOf(t) - seasons.indexOf(x.season) <= 2) },
    { label: 'last 200 games', keep: (past) => past.slice(-200) },
  ];
  type Hit = { key: string; r: Row; p: PlayerLine; bar: { eff: number; pts: number } };
  const hitsOf = (w: Window): Hit[] => {
    const out: Hit[] = [];
    const history = new Map<number, Past[]>();
    for (const season of seasons) {
      const rs = ordered.filter((r) => r.season === season);
      if (targets.includes(season)) {
        const bars = new Map<number, { eff: number; pts: number }>();
        for (const [id, past] of history) {
          const kept = w.keep(past, season);
          if (kept.length >= 60) bars.set(id, { eff: top(kept.map((x) => x.eff)), pts: top(kept.map((x) => x.pts)) });
        }
        for (const r of rs) {
          if (r.note <= SCORING.blowoutMax || whyOf(r.g)?.nuclear) continue;
          for (const p of r.g.players) {
            const bar = p.id !== undefined ? bars.get(p.id) : undefined;
            const e = efficiency(p);
            if (bar && ((e >= floors.eff && e >= bar.eff) || (p.pts >= floors.pts && p.pts >= bar.pts))) {
              out.push({ key: `${r.g.id}:${p.id}`, r, p, bar });
            }
          }
        }
      }
      for (const r of rs) for (const p of r.g.players) {
        if (p.id === undefined || !played(p)) continue;
        const past = history.get(p.id) ?? [];
        past.push({ season, eff: efficiency(p), pts: p.pts });
        history.set(p.id, past);
      }
    }
    return out;
  };
  console.log(`  personal rocks by season (targets ${targets.join(', ')}: at least two seasons of history), 60 games minimum in the window`);
  console.log(`  ${'window'.padEnd(18)} ${targets.map((t) => t.padStart(8)).join('')}   players`);
  const all = windows.map((w) => ({ w, h: hitsOf(w) }));
  for (const { w, h } of all) {
    console.log(`  ${w.label.padEnd(18)} ${targets.map((t) => String(h.filter((x) => x.r.season === t).length).padStart(8)).join('')}   ${String(new Set(h.map((x) => x.p.id)).size).padStart(7)}`);
  }
  const base = new Set(all[0]!.h.map((x) => x.key));
  for (const { w, h } of all.slice(1, 3)) {
    const keys = new Set(h.map((x) => x.key));
    const added = h.filter((x) => !base.has(x.key));
    const removed = all[0]!.h.filter((x) => !keys.has(x.key));
    const show = (x: Hit) => `    ${(x.r.g.date ?? '').padEnd(10)} ${(x.p.name ?? '?').padEnd(24)} ${line(x.p)} · eff ${efficiency(x.p)} (bar ${x.bar.eff}, pts bar ${x.bar.pts}) · game ${x.r.note}%`;
    console.log(`\n  ${w.label}: ${added.length} more nights than with all the history`);
    for (const x of added.sort((a, b) => (a.r.g.date ?? '').localeCompare(b.r.g.date ?? ''))) console.log(show(x));
    console.log(`  ${w.label}: ${removed.length} fewer`);
    for (const x of removed.sort((a, b) => (a.r.g.date ?? '').localeCompare(b.r.g.date ?? ''))) console.log(show(x));
  }
}

// Do big scorers shoot better in close games? (November 5: "in a close game, a player stops before his
// percentages get ugly"). The big scoring nights, split by close game or blowout (isDisputed, not the
// rating: the rating counts efficiency, which would bias the split), with their shooting.
function scoringByCloseness(rows: Row[]): void {
  title('Big scoring nights: close games vs blowouts');
  const ts = (p: PlayerLine) => (p.fga + 0.44 * p.fta > 0 ? p.pts / (2 * (p.fga + 0.44 * p.fta)) : 0);
  const median = (xs: number[]) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length / 2)]! : NaN; };
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  console.log('  points   kind       lines   true shooting (median, average)   FG% median   efficiency median   eff below 38');
  for (const min of [40, 45, 48]) {
    const lines = rows.flatMap((r) => r.g.players.filter((p) => p.pts >= min).map((p) => ({ p, close: isDisputed(r.g) })));
    for (const [label, part] of [['close', lines.filter((l) => l.close)], ['blowout', lines.filter((l) => !l.close)]] as const) {
      const t = part.map((l) => ts(l.p));
      const fg = part.map((l) => (l.p.fga ? l.p.fgm / l.p.fga : 0));
      const e = part.map((l) => efficiency(l.p));
      console.log(`  ${String(min).padStart(3)}+    ${label.padEnd(8)} ${String(part.length).padStart(6)}   ${(100 * median(t)).toFixed(1).padStart(10)}%  ${(100 * avg(t)).toFixed(1).padStart(10)}%        ${(100 * median(fg)).toFixed(1).padStart(6)}%   ${String(median(e)).padStart(17)}   ${pct(e.filter((x) => x < 38).length, e.length).padStart(12)}`);
    }
  }
}

// Points in the rating (November 7, Dončić's 53 points at 41 efficiency, LAL rated 73): the rating only
// reads efficiency. Simulated: each player's value = max(efficiency, points − k), for a few k. And a huge
// tier by points (50+ points, like the big tier's 40-point rule).
function scoringInRating(rows: Row[]): void {
  title('Points in the rating: max(efficiency, points − k)');
  const { threshold, divisor } = SCORING.performance;
  const ratingWith = (g: Game, k: number) => {
    const perf = g.players.reduce((sum, p) => sum + Math.max(0, Math.max(efficiency(p), p.pts - k) - threshold) ** 2 / divisor, 0);
    const points = competitivenessPoints(g) + perf;
    const raw = isDisputed(g) ? disputedBaseFor(g) + points : Math.min(SCORING.blowoutMax, points);
    return Math.min(100, Math.round(raw));
  };
  const today = rows.map((r) => r.note);
  console.log('  variant              50%+    at 100   games that move   avg change of those   max change');
  console.log(`  ${'today (efficiency)'.padEnd(18)} ${pct(today.filter((n) => n >= 50).length, rows.length).padStart(6)}   ${String(today.filter((n) => n >= 100).length).padStart(6)}`);
  for (const k of [10, 5, 0]) {
    const r2 = rows.map((r) => ratingWith(r.g, k));
    const moved = rows.map((r, i) => ({ r, d: r2[i]! - r.note, n: r2[i]! })).filter((x) => x.d !== 0);
    const avgD = moved.length ? moved.reduce((a, x) => a + x.d, 0) / moved.length : 0;
    console.log(`  ${`points − ${k}`.padEnd(18)} ${pct(r2.filter((n) => n >= 50).length, rows.length).padStart(6)}   ${String(r2.filter((n) => n >= 100).length).padStart(6)}   ${String(moved.length).padStart(15)}   ${avgD.toFixed(1).padStart(19)}   ${String(Math.max(0, ...moved.map((x) => x.d))).padStart(10)}`);
    if (k === 5) {
      console.log('    the 20 games that move most with points − 5:');
      for (const x of moved.sort((a, b) => b.d - a.d).slice(0, 20)) {
        const star = [...x.r.g.players].sort((a, b) => (b.pts - efficiency(b)) - (a.pts - efficiency(a)))[0]!;
        console.log(`      ${(x.r.g.date ?? '').padEnd(10)} ${`${x.r.g.away}@${x.r.g.home}`.padEnd(8)} ${String(x.r.note).padStart(3)} → ${String(x.n).padStart(3)}   ${(star.name ?? '?').padEnd(24)} ${line(star)} · eff ${efficiency(star)}`);
      }
    }
  }

  title('A huge tier by points too (50+ points)');
  const lines = rows.flatMap((r) => r.g.players.map((p) => ({ r, p, e: efficiency(p) })));
  const up = lines.filter((l) => l.p.pts >= 50 && l.e < SCORING.why.hugeNight && !whyOf(l.r.g)?.nuclear);
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  console.log(`  50+ points under the huge efficiency (${SCORING.why.hugeNight}), not a rock: ${up.length} lines (${seasons.map((s) => `${s} ${up.filter((l) => l.r.season === s).length}`).join(' · ')}): big today, huge with the rule`);
  for (const l of up.sort((a, b) => (a.r.g.date ?? '').localeCompare(b.r.g.date ?? ''))) {
    console.log(`    ${(l.r.g.date ?? '').padEnd(10)} ${(l.p.name ?? '?').padEnd(24)} ${line(l.p)} · eff ${l.e} · game ${l.r.note}%`);
  }
}

// Shooting in the rating (November 8): today each player is worth max(efficiency, points − pointsGap),
// however he scored them. With the true shooting, TS = pts / (2 × (FGA + 0.44 × FTA)) (league average
// around 57-58%), the gap could depend on the shooting: no gap or a bonus for an efficient night, a
// bigger gap for a player who chucks. Each variant is a ladder of (TS floor → points added), first match
// wins; the last step applies below every floor.
const trueShooting = (p: PlayerLine) => {
  const tsa = 2 * (p.fga + 0.44 * p.fta);
  return tsa > 0 ? p.pts / tsa : 0;
};
type Ladder = { label: string; steps: [number, number][]; below: number };
function shootingInRating(rows: Row[]): void {
  title('Shooting in the rating: points − gap, the gap set by the true shooting');
  const { threshold, divisor, pointsGap } = SCORING.performance;
  const valueWith = (p: PlayerLine, l: Ladder) => {
    const ts = trueShooting(p);
    const add = l.steps.find(([floor]) => ts >= floor)?.[1] ?? l.below;
    return Math.max(0, Math.max(efficiency(p), p.pts + add) - threshold) ** 2 / divisor;
  };
  const todayValue = (p: PlayerLine) => Math.max(0, Math.max(efficiency(p), p.pts - pointsGap) - threshold) ** 2 / divisor;
  const ratingWith = (g: Game, value: (p: PlayerLine) => number) => {
    const points = competitivenessPoints(g) + g.players.reduce((s, p) => s + value(p), 0);
    const raw = isDisputed(g) ? disputedBaseFor(g) + points : Math.min(SCORING.blowoutMax, points);
    return Math.min(100, Math.round(raw));
  };

  const scorers = rows.flatMap((r) => r.g.players.filter((p) => p.pts >= 35).map((p) => ({ r, p, ts: trueShooting(p) })));
  const sortedTs = scorers.map((x) => x.ts).sort((a, b) => a - b);
  const tsPct = (x: number) => `${(100 * x).toFixed(0)}%`;
  console.log(`  ${scorers.length} nights at 35+ points · TS: 10% ${tsPct(quantile(sortedTs, 0.1))} · 25% ${tsPct(quantile(sortedTs, 0.25))} · median ${tsPct(quantile(sortedTs, 0.5))} · 75% ${tsPct(quantile(sortedTs, 0.75))} · 90% ${tsPct(quantile(sortedTs, 0.9))}`);
  const bands = [0, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, Infinity];
  console.log(`  by TS band: ${bands.slice(0, -1).map((b, i) => `${b === 0 ? '<' : ''}${tsPct(b === 0 ? bands[1]! : b)}${b === 0 ? '' : bands[i + 1] === Infinity ? '+' : `–${tsPct(bands[i + 1]!)}`} ${scorers.filter((x) => x.ts >= b && x.ts < bands[i + 1]!).length}`).join(' · ')}`);
  console.log(`  (the gap only matters when points − gap beats the efficiency: ${scorers.filter((x) => x.p.pts - pointsGap > efficiency(x.p)).length} of these nights today)`);

  const g = -pointsGap;
  const ladders: Ladder[] = [
    { label: 'TS 58%+ → no gap', steps: [[0.58, 0]], below: g },
    { label: 'TS 60%+ → no gap', steps: [[0.6, 0]], below: g },
    { label: 'TS 62%+ → no gap', steps: [[0.62, 0]], below: g },
    { label: 'TS 65%+ → no gap', steps: [[0.65, 0]], below: g },
    { label: 'TS 60%+ → +5', steps: [[0.6, 5]], below: g },
    { label: 'TS 65%+ → +5', steps: [[0.65, 5]], below: g },
    { label: '65%+ +5 · 60%+ 0', steps: [[0.65, 5], [0.6, 0]], below: g },
    { label: '<50% → −10', steps: [[0.5, g]], below: -10 },
    { label: '<50% −10 · <45% −15', steps: [[0.5, g], [0.45, -10]], below: -15 },
    { label: 'ladder A', steps: [[0.6, 0], [0.5, g]], below: -10 },
    { label: 'ladder B', steps: [[0.65, 5], [0.6, 0], [0.5, g]], below: -10 },
    { label: 'ladder C', steps: [[0.65, 5], [0.6, 0], [0.5, g], [0.45, -10]], below: -15 },
  ];
  console.log('    ladder A: 60%+ 0 · 50–60% −5 · <50% −10');
  console.log('    ladder B: 65%+ +5 · 60–65% 0 · 50–60% −5 · <50% −10');
  console.log('    ladder C: 65%+ +5 · 60–65% 0 · 50–60% −5 · 45–50% −10 · <45% −15');

  const today = rows.map((r) => r.note);
  console.log('\n  variant                    50%+   at 100   up   down   avg up   avg down   max up   max down');
  console.log(`  ${`today (points − ${pointsGap})`.padEnd(24)} ${pct(today.filter((n) => n >= 50).length, rows.length).padStart(6)}   ${String(today.filter((n) => n >= 100).length).padStart(6)}`);
  const results = ladders.map((l) => {
    const n = rows.map((r) => ratingWith(r.g, (p) => valueWith(p, l)));
    const d = rows.map((r, i) => n[i]! - r.note);
    const up = d.filter((x) => x > 0);
    const down = d.filter((x) => x < 0);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    console.log(`  ${l.label.padEnd(24)} ${pct(n.filter((x) => x >= 50).length, rows.length).padStart(6)}   ${String(n.filter((x) => x >= 100).length).padStart(6)}   ${String(up.length).padStart(4)}   ${String(down.length).padStart(4)}   ${avg(up).toFixed(1).padStart(6)}   ${avg(down).toFixed(1).padStart(8)}   ${String(Math.max(0, ...up)).padStart(6)}   ${String(Math.min(0, ...down)).padStart(8)}`);
    return { l, n };
  });

  // The player whose value changes most, not the top scorer: that's the line behind the move
  const mover = (r: Row, l: Ladder) => [...r.g.players].sort((a, b) => Math.abs(valueWith(b, l) - todayValue(b)) - Math.abs(valueWith(a, l) - todayValue(a)))[0]!;
  const show = (x: { r: Row; n: number }, l: Ladder) => {
    const p = mover(x.r, l);
    console.log(`      ${(x.r.g.date ?? '').padEnd(10)} ${`${x.r.g.away}@${x.r.g.home}`.padEnd(8)} ${String(x.r.note).padStart(3)} → ${String(x.n).padStart(3)}   ${(p.name ?? '?').padEnd(24)} ${line(p)} · eff ${efficiency(p)} · TS ${tsPct(trueShooting(p))}`);
  };
  for (const label of ['TS 60%+ → no gap', 'ladder B', 'ladder C']) {
    const { l, n } = results.find((x) => x.l.label === label)!;
    const moved = rows.map((r, i) => ({ r, n: n[i]!, d: n[i]! - r.note })).filter((x) => x.d !== 0);
    console.log(`\n  ${label}: the 15 biggest rises`);
    for (const x of moved.filter((x) => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 15)) show(x, l);
    const falls = moved.filter((x) => x.d < 0).sort((a, b) => a.d - b.d);
    if (falls.length) {
      console.log(`  ${label}: the 15 biggest falls`);
      for (const x of falls.slice(0, 15)) show(x, l);
    }
  }
}

// A game close after three quarters that a star puts away in the fourth (Giannis, 64 points, December
// 2023: +7 after Q3, 26 points in Q4, rated a blowout). Today, only a margin of maxMarginAfterQ3 or less
// after Q3 makes such a game competitive (base q3OnlyBase). Simulated: a wider Q3 margin, alone or with a
// player scoring a lot in Q4/OT. Only the games rated blowouts today can move.
function q3Door(rows: Row[]): void {
  title('Close after Q3, put away in the fourth: a wider Q3 door?');
  const q3 = SCORING.disputed.maxMarginAfterQ3;
  const starQ4 = (r: Row) => Math.max(0, ...r.g.players.map((p) => q4Points(r.tl ?? [], p.id) ?? 0));
  const rateAsQ3 = (r: Row) => Math.min(100, Math.round(SCORING.q3OnlyBase + competitivenessPoints(r.g) + performancePoints(r.g)));
  type Variant = { label: string; door: (r: Row) => boolean };
  const variants: Variant[] = [];
  for (const m of [q3 + 1, q3 + 2, q3 + 3]) variants.push({ label: `Q3 within ${m}`, door: (r) => marginAfterQ3(r.g) <= m });
  for (const m of [q3 + 2, q3 + 3, q3 + 5]) {
    for (const pts of [15, 20]) variants.push({ label: `Q3 within ${m} + ${pts} pts in Q4`, door: (r) => marginAfterQ3(r.g) <= m && starQ4(r) >= pts });
  }
  const blowouts = rows.filter((r) => !isDisputed(r.g));
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  console.log(`  ${rows.length} games, ${blowouts.length} blowouts today (Q3 door today: within ${q3})`);
  console.log(`  ${'variant'.padEnd(30)} moved  per season   at 50%+ after   avg new rating   50%+ overall`);
  const base50 = rows.filter((r) => r.note >= 50).length;
  for (const v of variants) {
    const moved = blowouts.filter(v.door);
    const now50 = moved.filter((r) => rateAsQ3(r) >= 50).length;
    const avg = moved.length ? moved.reduce((a, r) => a + rateAsQ3(r), 0) / moved.length : 0;
    console.log(`  ${v.label.padEnd(30)} ${String(moved.length).padStart(5)}  ${(moved.length / seasons.length).toFixed(1).padStart(10)}   ${String(now50).padStart(13)}   ${avg.toFixed(0).padStart(14)}   ${pct(base50 + now50, rows.length).padStart(12)}`);
  }
  for (const label of [`Q3 within ${q3 + 2}`, `Q3 within ${q3 + 3} + 20 pts in Q4`]) {
    const v = variants.find((x) => x.label === label)!;
    const moved = blowouts.filter(v.door).sort((a, b) => rateAsQ3(b) - rateAsQ3(a));
    console.log(`\n  ${label}: the ${moved.length} games, best new rating first (first 25)`);
    for (const r of moved.slice(0, 25)) {
      const star = [...r.g.players].sort((a, b) => (q4Points(r.tl ?? [], b.id) ?? 0) - (q4Points(r.tl ?? [], a.id) ?? 0))[0]!;
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(rateAsQ3(r)).padStart(3)}   ${blowoutStory(r)}   ${star.name ?? '?'} ${q4Points(r.tl ?? [], star.id) ?? '?'} pts in Q4/OT (${star.pts})`);
    }
  }
}

// The average margin over the fourth quarter, weighted by time: how much of it was still in reach
function avgQ4Margin(tl: Timeline): number {
  let margin = 0;
  for (const [period, , h, a] of tl) if (period < 4) margin = h - a;
  let t = 720, sum = 0;
  for (const [period, left, h, a] of tl) {
    if (period !== 4) continue;
    sum += Math.abs(margin) * (t - left);
    margin = h - a;
    t = left;
  }
  sum += Math.abs(margin) * t;
  return sum / 720;
}

// Still in reach midway through the fourth (November 7): "a blowout is a game with no interest left; 10
// points down in the fourth, there's still some". Simulated: the game is competitive (base q3OnlyBase)
// when the margin with 6:00 left in the fourth was small enough. Only today's blowouts can move.
function sixMinutesDoor(rows: Row[]): void {
  title('Still in reach in the fourth: a new door? (margin at 6:00, average margin over the fourth)');
  const rateAsQ3 = (r: Row) => Math.min(100, Math.round(SCORING.q3OnlyBase + competitivenessPoints(r.g) + performancePoints(r.g)));
  const blowouts = rows.filter((r) => !isDisputed(r.g) && r.tl);
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  const base50 = rows.filter((r) => r.note >= 50).length;
  console.log(`  ${'margin at 6:00'.padEnd(16)} moved  per season   at 50%+ after   avg new rating   50%+ overall`);
  for (const m of [6, 8, 10]) {
    const moved = blowouts.filter((r) => Math.abs(marginInQ4(r.tl!, 360)) <= m);
    const now50 = moved.filter((r) => rateAsQ3(r) >= 50).length;
    const avg = moved.length ? moved.reduce((a, r) => a + rateAsQ3(r), 0) / moved.length : 0;
    console.log(`  ${`within ${m}`.padEnd(16)} ${String(moved.length).padStart(5)}  ${(moved.length / seasons.length).toFixed(1).padStart(10)}   ${String(now50).padStart(13)}   ${avg.toFixed(0).padStart(14)}   ${pct(base50 + now50, rows.length).padStart(12)}`);
  }
  console.log(`  ${'avg Q4 margin'.padEnd(16)} moved  per season   at 50%+ after   avg new rating   50%+ overall`);
  for (const m of [6, 8, 10]) {
    const moved = blowouts.filter((r) => avgQ4Margin(r.tl!) <= m);
    const now50 = moved.filter((r) => rateAsQ3(r) >= 50).length;
    const avg = moved.length ? moved.reduce((a, r) => a + rateAsQ3(r), 0) / moved.length : 0;
    console.log(`  ${`within ${m}`.padEnd(16)} ${String(moved.length).padStart(5)}  ${(moved.length / seasons.length).toFixed(1).padStart(10)}   ${String(now50).padStart(13)}   ${avg.toFixed(0).padStart(14)}   ${pct(base50 + now50, rows.length).padStart(12)}`);
  }
  for (const m of [8]) {
    const moved = blowouts.filter((r) => avgQ4Margin(r.tl!) <= m).sort((a, b) => rateAsQ3(b) - rateAsQ3(a));
    console.log(`\n  average Q4 margin within ${m}: the ${moved.length} games, best new rating first (first 25)`);
    for (const r of moved.slice(0, 25)) {
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(rateAsQ3(r)).padStart(3)}   avg Q4 ${avgQ4Margin(r.tl!).toFixed(1)} · ${blowoutStory(r)}`);
    }
  }
  for (const m of [8, 10]) {
    const moved = blowouts.filter((r) => Math.abs(marginInQ4(r.tl!, 360)) <= m).sort((a, b) => rateAsQ3(b) - rateAsQ3(a));
    console.log(`\n  within ${m} at 6:00: the ${moved.length} games, best new rating first (first 25)`);
    for (const r of moved.slice(0, 25)) {
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(rateAsQ3(r)).padStart(3)}   ${blowoutStory(r)}`);
    }
  }
}

// The largest margin over a stretch of the fourth (from the start of the quarter down to secondsLeft)
function maxQ4Margin(tl: Timeline, downTo: number): number {
  let margin = 0;
  for (const [period, , h, a] of tl) if (period < 4) margin = h - a;
  let max = Math.abs(margin);
  for (const [period, left, h, a] of tl) {
    if (period !== 4 || left < downTo) continue;
    margin = h - a;
    max = Math.max(max, Math.abs(margin));
  }
  return max;
}

// November 7, the user's proposal: (1) one second of clutch (the loser within 5 in the last 5 minutes) is
// enough: not a blowout (base disputedBase); (2) the first half of the fourth stayed within about 10:
// not a blowout (base q3OnlyBase). Only today's blowouts can move.
function clutchAndEarlyQ4(rows: Row[]): void {
  title('Not a blowout: 1 s of clutch, or the first half of the fourth within about 10');
  const rate = (r: Row, base: number) => Math.min(100, Math.round(base + competitivenessPoints(r.g) + performancePoints(r.g)));
  const blowouts = rows.filter((r) => !isDisputed(r.g) && r.tl && r.g.late);
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  const base50 = rows.filter((r) => r.note >= 50).length;
  type V = { label: string; base: (r: Row) => number | null };
  const clutch = (r: Row) => r.g.late!.clutchSeconds > 0;
  const early = (m: number) => (r: Row) => maxQ4Margin(r.tl!, 360) <= m;
  const variants: V[] = [
    { label: '1 s of clutch', base: (r) => (clutch(r) ? SCORING.disputedBase : null) },
    ...[10, 11, 12].map((m) => ({ label: `12:00→6:00 within ${m}`, base: (r: Row) => (early(m)(r) ? SCORING.q3OnlyBase : null) })),
    ...[10, 12].map((m) => ({
      label: `clutch, or 12:00→6:00 within ${m}`,
      base: (r: Row) => (clutch(r) ? SCORING.disputedBase : early(m)(r) ? SCORING.q3OnlyBase : null),
    })),
  ];
  console.log(`  ${'variant'.padEnd(34)} moved  per season   at 50%+ after   avg new rating   50%+ overall`);
  for (const v of variants) {
    const moved = blowouts.filter((r) => v.base(r) !== null);
    const now = moved.map((r) => rate(r, v.base(r)!));
    const now50 = now.filter((n) => n >= 50).length;
    const avg = now.length ? now.reduce((a, b) => a + b, 0) / now.length : 0;
    console.log(`  ${v.label.padEnd(34)} ${String(moved.length).padStart(5)}  ${(moved.length / seasons.length).toFixed(1).padStart(10)}   ${String(now50).padStart(13)}   ${avg.toFixed(0).padStart(14)}   ${pct(base50 + now50, rows.length).padStart(12)}`);
  }
  for (const v of [variants[0]!, variants[1]!]) {
    const moved = blowouts.filter((r) => v.base(r) !== null).sort((a, b) => rate(b, v.base(b)!) - rate(a, v.base(a)!));
    console.log(`\n  ${v.label}: the ${moved.length} games, best new rating first (first 25)`);
    for (const r of moved.slice(0, 25)) {
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(rate(r, v.base(r)!)).padStart(3)}   clutch ${r.g.late!.clutchSeconds} s · Q4 max to 6:00 ${maxQ4Margin(r.tl!, 360)} · ${blowoutStory(r)}`);
    }
  }
}

// The average margin over a stretch of the fourth (from 12:00 down to secondsLeft), weighted by time
function avgEarlyQ4Margin(tl: Timeline, downTo: number): number {
  let margin = 0;
  for (const [period, , h, a] of tl) if (period < 4) margin = h - a;
  let t = 720, sum = 0;
  for (const [period, left, h, a] of tl) {
    if (period !== 4) continue;
    if (left < downTo) break;
    sum += Math.abs(margin) * (t - left);
    margin = h - a;
    t = left;
  }
  sum += Math.abs(margin) * (t - downTo);
  return sum / (720 - downTo);
}

// The whole new definition of a competitive game (November 7), base disputedBase for all (no Q3 door, no
// base q3OnlyBase): close to the end as today, or 1 s of clutch (NBA's definition: within 5 in the last 5
// minutes), or the first half of the fourth still playable. Three measures of "playable".
function newCompetitive(rows: Row[]): void {
  title('A new definition of a competitive game: close to the end, 1 s of clutch, or a playable start of the fourth');
  const c = SCORING.disputed;
  const toTheEnd = (g: Game) => closeFinalMargin(g) || loserBiggestLead(g) >= c.minLoserBiggestLead || closeByClutch(g);
  type V = { label: string; playable: (r: Row) => boolean };
  const variants: V[] = [
    { label: 'peak 12:00→6:00 within 10', playable: (r) => maxQ4Margin(r.tl!, 360) <= 10 },
    { label: 'peak 12:00→6:00 within 12', playable: (r) => maxQ4Margin(r.tl!, 360) <= 12 },
    { label: 'peak 12:00→6:00 within 13', playable: (r) => maxQ4Margin(r.tl!, 360) <= 13 },
    { label: 'peak 12:00→6:00 within 14', playable: (r) => maxQ4Margin(r.tl!, 360) <= 14 },
    { label: 'average 12:00→6:00 within 10', playable: (r) => avgEarlyQ4Margin(r.tl!, 360) <= 10 },
  ];
  const disputedNew = (r: Row, v: V) => toTheEnd(r.g) || (r.tl !== undefined && r.g.late !== undefined && (r.g.late.clutchSeconds > 0 || v.playable(r)));
  const rate = (r: Row, d: boolean) => {
    const points = competitivenessPoints(r.g) + performancePoints(r.g);
    return Math.min(100, Math.round(d ? SCORING.disputedBase + points : Math.min(SCORING.blowoutMax, points)));
  };
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  console.log(`  today: ${pct(rows.filter((r) => isDisputed(r.g)).length, rows.length)} competitive · ${pct(rows.filter((r) => r.note >= 50).length, rows.length)} at 50%+ · ${rows.filter((r) => r.note >= 100).length} at 100`);
  console.log(`  ${'playable start of the fourth'.padEnd(30)} competitive   50%+   at 100   become competitive (per season)   stop being competitive   base 40 → 50`);
  const results = variants.map((v) => {
    const d = rows.map((r) => disputedNew(r, v));
    const n = rows.map((r, i) => rate(r, d[i]!));
    const gained = rows.filter((r, i) => d[i] && !isDisputed(r.g));
    const lost = rows.filter((r, i) => !d[i] && isDisputed(r.g));
    const raised = rows.filter((r, i) => d[i] && isDisputed(r.g) && disputedBaseFor(r.g) < SCORING.disputedBase);
    console.log(`  ${v.label.padEnd(30)} ${pct(d.filter(Boolean).length, rows.length).padStart(11)}   ${pct(n.filter((x) => x >= 50).length, rows.length).padStart(4)}   ${String(n.filter((x) => x >= 100).length).padStart(6)}   ${String(gained.length).padStart(16)} (${(gained.length / seasons.length).toFixed(1)})   ${String(lost.length).padStart(22)}   ${String(raised.length).padStart(12)}`);
    return { v, n, gained, lost };
  });
  const idx = new Map(rows.map((r, i) => [r, i]));
  // What each extra point adds, peak 12 → 13 → 14 (the games gained at that point only)
  for (const [from, to] of [[12, 13], [13, 14]] as const) {
    const added = rows.filter((r) => !isDisputed(r.g) && r.tl && r.g.late && r.g.late.clutchSeconds === 0
      && !(closeFinalMargin(r.g) || loserBiggestLead(r.g) >= c.minLoserBiggestLead || closeByClutch(r.g))
      && maxQ4Margin(r.tl, 360) > from && maxQ4Margin(r.tl, 360) <= to);
    console.log(`\n  peak ${to} instead of ${from}: ${added.length} more games become competitive (first 15)`);
    for (const r of added.slice(0, 15)) {
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(rate(r, true)).padStart(3)}   avg ${avgEarlyQ4Margin(r.tl!, 360).toFixed(1)} · ${blowoutStory(r)}`);
    }
  }
  for (const { v, n, gained, lost } of results.filter(({ v }) => !/within 1[34]$/.test(v.label))) {
    console.log(`\n  ${v.label}: the ${lost.length} games that stop being competitive (they only had the Q3 door)`);
    for (const r of lost.slice(0, 15)) {
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(n[idx.get(r)!]).padStart(3)}   peak ${maxQ4Margin(r.tl!, 360)} · avg ${avgEarlyQ4Margin(r.tl!, 360).toFixed(1)} · ${blowoutStory(r)}`);
    }
    const best = [...gained].sort((a, b) => n[idx.get(b)!]! - n[idx.get(a)!]!);
    console.log(`  ${v.label}: the ${gained.length} games that become competitive, best first (first 15)`);
    for (const r of best.slice(0, 15)) {
      console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(n[idx.get(r)!]).padStart(3)}   clutch ${r.g.late!.clutchSeconds} s · peak ${maxQ4Margin(r.tl!, 360)} · avg ${avgEarlyQ4Margin(r.tl!, 360).toFixed(1)} · ${blowoutStory(r)}`);
    }
  }
}

// The candidate (November 7): close to the end or 1 s of clutch → base disputedBase; else the start of the
// fourth playable (peak 12:00→6:00 within 12) → base q3OnlyBase; the Q3 door goes. The games just above and
// just under 50 with the playable door, to judge where they land.
function candidateDefinition(rows: Row[]): void {
  title('Candidate: close to the end or 1 s of clutch (base 50), playable start of the fourth (peak 12, base 40), no Q3 door');
  const c = SCORING.disputed;
  const toTheEnd = (g: Game) => closeFinalMargin(g) || loserBiggestLead(g) >= c.minLoserBiggestLead || closeByClutch(g);
  const baseOf = (r: Row): number | null => {
    if (toTheEnd(r.g) || (r.g.late && r.g.late.clutchSeconds > 0)) return SCORING.disputedBase;
    if (r.tl && r.g.late && maxQ4Margin(r.tl, 360) <= 12) return SCORING.q3OnlyBase;
    return null;
  };
  const rate = (r: Row) => {
    const points = competitivenessPoints(r.g) + performancePoints(r.g);
    const b = baseOf(r);
    return Math.min(100, Math.round(b !== null ? b + points : Math.min(SCORING.blowoutMax, points)));
  };
  const n = rows.map(rate);
  const idx = new Map(rows.map((r, i) => [r, i]));
  const competitive = rows.filter((r) => baseOf(r) !== null);
  console.log(`  today:     ${pct(rows.filter((r) => isDisputed(r.g)).length, rows.length)} competitive · ${pct(rows.filter((r) => r.note >= 50).length, rows.length)} at 50%+ · ${rows.filter((r) => r.note >= 100).length} at 100`);
  console.log(`  candidate: ${pct(competitive.length, rows.length)} competitive · ${pct(n.filter((x) => x >= 50).length, rows.length)} at 50%+ · ${n.filter((x) => x >= 100).length} at 100`);
  const moved = rows.filter((r, i) => n[i] !== r.note);
  console.log(`  ${moved.length} games change rating: ${moved.filter((r) => n[idx.get(r)!]! > r.note).length} up, ${moved.filter((r) => n[idx.get(r)!]! < r.note).length} down`);
  const playable = rows.filter((r) => baseOf(r) === SCORING.q3OnlyBase);
  const above = playable.filter((r) => n[idx.get(r)!]! >= 50).sort((a, b) => n[idx.get(a)!]! - n[idx.get(b)!]!);
  const under = playable.filter((r) => n[idx.get(r)!]! < 50).sort((a, b) => n[idx.get(b)!]! - n[idx.get(a)!]!);
  console.log(`\n  playable start only (base 40): ${playable.length} games, ${above.length} at 50%+, ${under.length} under`);
  console.log('  just above 50 (lowest first, first 15):');
  for (const r of above.slice(0, 15)) console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(n[idx.get(r)!]).padStart(3)}   peak ${maxQ4Margin(r.tl!, 360)} · ${blowoutStory(r)}`);
  console.log('  just under 50 (highest first, first 15):');
  for (const r of under.slice(0, 15)) console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(n[idx.get(r)!]).padStart(3)}   peak ${maxQ4Margin(r.tl!, 360)} · ${blowoutStory(r)}`);
  const lost = rows.filter((r) => isDisputed(r.g) && baseOf(r) === null);
  console.log(`\n  ${lost.length} games stop being competitive (Q3 door only, decided before 6:00), first 10:`);
  for (const r of lost.slice(0, 10)) console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(n[idx.get(r)!]).padStart(3)}   peak ${maxQ4Margin(r.tl!, 360)} · ${blowoutStory(r)}`);
}

// The playable start of the fourth, two measures side by side (November 7): the peak from 12:00 to 6:00
// within 12, or the margin at 6:00 within 12 ("at 6:00, 12 points is still playable"). The second contains
// the first; the games it adds are those that went above 12 before 6:00 and came back.
function peakOrSnapshot(rows: Row[]): void {
  title('Playable start of the fourth: peak 12:00→6:00 within 12, or margin at 6:00 within 12');
  const c = SCORING.disputed;
  const toTheEnd = (g: Game) => closeFinalMargin(g) || loserBiggestLead(g) >= c.minLoserBiggestLead || closeByClutch(g)
    || (g.late !== undefined && g.late.clutchSeconds > 0);
  const variants: [string, (r: Row) => boolean][] = [
    ['peak 12:00→6:00 within 12', (r) => maxQ4Margin(r.tl!, 360) <= 12],
    ['margin at 6:00 within 12', (r) => Math.abs(marginInQ4(r.tl!, 360)) <= 12],
  ];
  const results = variants.map(([label, playable]) => {
    const base = (r: Row) => (toTheEnd(r.g) ? SCORING.disputedBase : r.tl && r.g.late && playable(r) ? SCORING.q3OnlyBase : null);
    const n = rows.map((r) => {
      const points = competitivenessPoints(r.g) + performancePoints(r.g);
      const b = base(r);
      return Math.min(100, Math.round(b !== null ? b + points : Math.min(SCORING.blowoutMax, points)));
    });
    const competitive = rows.filter((r) => base(r) !== null).length;
    console.log(`  ${label.padEnd(28)} ${pct(competitive, rows.length)} competitive · ${pct(n.filter((x) => x >= 50).length, rows.length)} at 50%+ · ${n.filter((x) => x >= 100).length} at 100`);
    return { label, base, n };
  });
  console.log(`  ${'today'.padEnd(28)} ${pct(rows.filter((r) => isDisputed(r.g)).length, rows.length)} competitive · ${pct(rows.filter((r) => r.note >= 50).length, rows.length)} at 50%+ · ${rows.filter((r) => r.note >= 100).length} at 100`);
  const [peak, snap] = results as [typeof results[0], typeof results[0]];
  const idx = new Map(rows.map((r, i) => [r, i]));
  const added = rows.filter((r) => snap.base(r) !== null && peak.base(r) === null).sort((a, b) => snap.n[idx.get(b)!]! - snap.n[idx.get(a)!]!);
  const above = added.filter((r) => snap.n[idx.get(r)!]! >= 50).length;
  console.log(`\n  the margin at 6:00 adds ${added.length} games (${(added.length / new Set(rows.map((r) => r.season)).size).toFixed(1)} per season), ${above} of them at 50%+: above 12 before 6:00, back within 12 at 6:00`);
  console.log('  best first (first 20):');
  for (const r of added.slice(0, 20)) {
    console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(snap.n[idx.get(r)!]).padStart(3)}   peak ${maxQ4Margin(r.tl!, 360)} · ${blowoutStory(r)}`);
  }
  console.log('  lowest first (first 10):');
  for (const r of added.slice(-10).reverse()) {
    console.log(`    ${(r.g.date ?? '').padEnd(10)} ${`${r.g.away}@${r.g.home}`.padEnd(8)} ${String(r.note).padStart(3)} → ${String(snap.n[idx.get(r)!]).padStart(3)}   peak ${maxQ4Margin(r.tl!, 360)} · ${blowoutStory(r)}`);
  }
}

// November 8: a game put away at 6:00 (more than maxMarginAt6) where the loser comes back late, without
// ever getting within 5 (no clutch second): rated a blowout today. For each closest margin from 6 to 10,
// the blowouts of today where the loser got that close after 6:00, and when.
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
function lateRun(rows: Row[]): void {
  title('Late runs: blowouts where the loser got within 6 to 10 after 6:00');
  const blowouts = rows.filter((r) => r.tl && !isDisputed(r.g));
  const seasons = [...new Set(rows.map((r) => r.season))].sort();
  const runs = blowouts.map((r) => {
    const tl = r.tl!;
    const last = tl[tl.length - 1]!;
    const sign = last[2] > last[3] ? 1 : -1;
    let closest = Math.abs(marginInQ4(tl, 360));
    let at = 360;
    for (const [period, left, h, a] of tl) {
      if (period !== 4 || left > 360) continue;
      const m = sign * (h - a);
      if (m < closest) { closest = m; at = left; }
    }
    return { r, closest, at };
  });
  console.log(`  ${blowouts.length} blowouts today (with the play-by-play), ${seasons.length} seasons`);
  console.log('  closest   games   per season   reached at 2:00 or before   rated with base 50');
  for (let n = 6; n <= 10; n++) {
    const hit = runs.filter((x) => x.closest <= n);
    const early = hit.filter((x) => x.at >= 120).length;
    const notes = hit.map((x) => Math.min(100, Math.round(disputedBaseFor({ ...x.r.g, late: { ...x.r.g.late!, marginAt6: 0 } }) + competitivenessPoints(x.r.g) + performancePoints(x.r.g))));
    const avg = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
    console.log(`  ≤ ${String(n).padEnd(6)} ${String(hit.length).padStart(5)}   ${(hit.length / seasons.length).toFixed(1).padStart(10)}   ${`${early} (${pct(early, hit.length)})`.padStart(25)}   ${`avg ${avg.toFixed(0)}`.padStart(18)}`);
  }
  for (let n = 6; n <= 10; n++) {
    const exact = runs.filter((x) => x.closest === n).sort((a, b) => b.at - a.at);
    console.log(`\n  closest exactly ${n} (${exact.length}), earliest first (first 12):`);
    for (const x of exact.slice(0, 12)) {
      console.log(`    ${(x.r.g.date ?? '').padEnd(10)} ${`${x.r.g.away}@${x.r.g.home}`.padEnd(8)} ${String(x.r.note).padStart(3)}%   within ${n} at ${clock(x.at)} · ${blowoutStory(x.r)}`);
    }
  }

  // The whole film of the last 6 minutes for the games within 6: the winner's lead after every score,
  // and how long the loser stayed within 6 and within 8 (to tell a real run from a single possession)
  const film = runs.filter((x) => x.closest <= 6).sort((a, b) => b.at - a.at);
  console.log(`\n  the film of the last 6:00, games within 6 (${film.length}): the winner's lead after every score`);
  for (const x of film) {
    const tl = x.r.tl!;
    const last = tl[tl.length - 1]!;
    const sign = last[2] > last[3] ? 1 : -1;
    const q4 = tl.filter(([period, left]) => period === 4 && left <= 360);
    let lead = sign * marginInQ4(tl, 360);
    let from = 360;
    let within6 = 0;
    let within8 = 0;
    const steps: string[] = [];
    for (const [, left, h, a] of q4) {
      if (lead <= 6) within6 += from - left;
      if (lead <= 8) within8 += from - left;
      lead = sign * (h - a);
      from = left;
      steps.push(`${clock(left)} ${lead}`);
    }
    if (lead <= 6) within6 += from;
    if (lead <= 8) within8 += from;
    console.log(`\n    ${(x.r.g.date ?? '').padEnd(10)} ${`${x.r.g.away}@${x.r.g.home}`.padEnd(8)} ${String(x.r.note).padStart(3)}%   lead at 6:00 ${sign * marginInQ4(tl, 360)} · final ${lead} · within 6 for ${clock(within6)} · within 8 for ${clock(within8)}`);
    for (let i = 0; i < steps.length; i += 12) console.log(`      ${steps.slice(i, i + 12).join(' · ')}`);
  }
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('flame-study prints player names and how the settings behave: never on GitHub Actions (public logs).');
  }
  const args = process.argv.slice(2);
  // One season or several: npm run flame-study -- 2021-22 2022-23 2023-24 2024-25 2025-26
  const seasons = args.filter((a) => /^\d{4}-\d{2}$/.test(a));
  if (seasons.length === 0) throw new Error('Usage: npm run flame-study -- 2025-26 [2024-25 …] [--at 40] [--player "Stephen Curry"]');
  loadScoring();
  const atArg = args.indexOf('--at');
  const at = atArg >= 0 ? Number(args[atArg + 1]) : SCORING.why.bigNight;
  if (!Number.isFinite(at)) throw new Error('--at needs a number, e.g. --at 40');

  const rows: Row[] = [];
  let v2 = 0;
  let withQ3 = 0;
  for (const season of seasons) {
    const dir = path.join(ROOT, '.cache', 'boxscores', season);
    const files = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.json')) : [];
    if (files.length === 0) throw new Error(`No box score in ${dir}: run npm run season-stats -- ${season} --clutch first.`);
    const pbpDir = path.join(ROOT, '.cache', 'playbyplay', season);
    for (const f of files) {
      const g0 = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as CachedGame;
      const pbp = path.join(pbpDir, f);
      let g = g0;
      let tl: Timeline | undefined;
      if (existsSync(pbp)) {
        tl = JSON.parse(await readFile(pbp, 'utf8')) as Timeline;
        g = { ...g0, late: lateFrom(tl, g0.periods.length) };
        v2++;
        // The first three quarters (the blowout door), from the period stats when downloaded
        const ps = path.join(ROOT, '.cache', 'periodstats', season, f);
        if (existsSync(ps)) {
          const stats = JSON.parse(await readFile(ps, 'utf8')) as PeriodStats;
          g = { ...g, late: { ...g.late!, firstThree: firstThreeQuarters(stats, g) } };
          withQ3++;
        }
      }
      const effs = g.players.map(efficiency);
      rows.push({ g, season, note: displayScore(g), effs, best: Math.max(0, ...effs), maxPts: Math.max(0, ...g.players.map((p) => p.pts)), tl });
    }
  }
  const nights = new Map<string, Row[]>();
  for (const r of rows) nights.set(r.g.date ?? '?', [...(nights.get(r.g.date ?? '?') ?? []), r]);

  console.log(`Flame study, ${seasons.join(' + ')}: ${rows.length} games (${v2} rated with the play-by-play, ${withQ3} with the first three quarters), focus on ${at}+`);
  console.log(`The flame: efficiency at the threshold, or ${SCORING.why.bigPoints}+ points (setting why.bigPoints).`);
  distribution(rows);
  thresholdTable(rows, nights);
  nightsReport(nights, at);
  concentration(rows, at);
  borderline(rows, at);
  scoringNights(rows, at);
  nuclearReport(rows);
  nuclearNights(rows);
  rockVariants(rows);
  buzzerBeaters(rows);
  personalPeaks(rows);
  seasonSummary(rows);
  threesNights(rows);
  peakWindows(rows);
  scoringByCloseness(rows);
  scoringInRating(rows);
  shootingInRating(rows);
  q3Door(rows);
  sixMinutesDoor(rows);
  clutchAndEarlyQ4(rows);
  newCompetitive(rows);
  candidateDefinition(rows);
  peakOrSnapshot(rows);
  lateRun(rows);
  const playerArg = args.indexOf('--player');
  if (playerArg >= 0 && args[playerArg + 1]) playerNights(rows, args[playerArg + 1]!, at);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
