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

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lateFrom, swings, type Timeline } from './nba/clutch.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import { displayScore, efficiency } from '../src/lib/scoring.ts';
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
const soloRock = (p: PlayerLine) => p.pts >= SCORING.why.nuclearPoints || efficiency(p) >= SCORING.why.nuclearEff || quad(p);
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
      }
      const effs = g.players.map(efficiency);
      rows.push({ g, season, note: displayScore(g), effs, best: Math.max(0, ...effs), maxPts: Math.max(0, ...g.players.map((p) => p.pts)), tl });
    }
  }
  const nights = new Map<string, Row[]>();
  for (const r of rows) nights.set(r.g.date ?? '?', [...(nights.get(r.g.date ?? '?') ?? []), r]);

  console.log(`Flame study, ${seasons.join(' + ')}: ${rows.length} games (${v2} rated with the play-by-play), focus on ${at}+`);
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
  const playerArg = args.indexOf('--player');
  if (playerArg >= 0 && args[playerArg + 1]) playerNights(rows, args[playerArg + 1]!, at);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
