// src/lib/scoring.ts
// Pure functions: same input, same rating. Easy to test.

import { SCORING } from '../config/scoring.ts';
import type { Game, PlayerLine } from '../types/game.ts';
import { trailingChance } from './winProbability.ts';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// --- Reading the game ---------------------------------------------------------

const scoreAfter = (g: Game, n: number) => ({
  home: sum(g.periods.slice(0, n).map((p) => p.home)),
  away: sum(g.periods.slice(0, n).map((p) => p.away)),
});

const marginAfter = (g: Game, n: number) => {
  const s = scoreAfter(g, n);
  return Math.abs(s.home - s.away);
};

export const regulationMargin = (g: Game) => marginAfter(g, 4);
export const marginAfterQ3 = (g: Game) => marginAfter(g, 3);
export const finalScore = (g: Game) => scoreAfter(g, g.periods.length);
export const overtimes = (g: Game) => Math.max(0, g.periods.length - 4);

export const loserBiggestLead = (g: Game) => {
  const f = finalScore(g);
  return f.home > f.away ? g.biggestLead.away : g.biggestLead.home;
};

// Standard efficiency: pts + reb + ast + stl + blk − missed FG − missed FT − turnovers
export const efficiency = (p: PlayerLine) =>
  p.pts + p.reb + p.ast + p.stl + p.blk - (p.fga - p.fgm) - (p.fta - p.ftm) - p.tov;

// --- Step 1: competitive game or blowout? --------------------------------------

// v2: a tight finish, seen in the play-by-play, whatever the final margin
export const closeByClutch = (g: Game) =>
  g.late !== undefined
  && (g.late.clutchSeconds >= SCORING.clutch.closeSeconds || g.late.marginAt2 <= SCORING.clutch.closeMarginAt2);

// A close final margin, unless garbage time made it: with the play-by-play, the game must also have been
// within reach with 2:00 left, or the loser must have got within 5 at some point in the last minutes.
export const closeFinalMargin = (g: Game) => {
  const c = SCORING.disputed;
  if (regulationMargin(g) > c.maxRegulationMargin) return false;
  return g.late === undefined || g.late.marginAt2 <= c.maxMarginAt2 || g.late.clutchSeconds > 0;
};

// The losing team's chance, down maxMarginAt6 with 6:00 left: the bar of the 6:00 door, in probability
export const aliveBar = () => trailingChance(SCORING.disputed.maxMarginAt6, 360, SCORING.winProbability);

// v2: did the losing team really believe in it at some point of the fourth? At least the 6:00 door's chance
// after 6:00, or the doubt before. Checked on every door: garbage time can make a final margin look close.
const loserBelieved = (late: NonNullable<Game['late']>) =>
  late.loserChanceAfter6 === undefined || late.loserChanceBefore6 === undefined
  || late.loserChanceAfter6 >= aliveBar() || late.loserChanceBefore6 >= SCORING.disputed.doubtChance;

// v2, the doors with the play-by-play: close at the end, a tight finish, one second of clutch (the NBA's
// definition: within 5 in the last 5 minutes), within reach with 6:00 left, a real chance late (a run
// after 6:00), or real doubt in the fourth before 6:00. The loser's early lead only gives comeback points.
const closeLate = (g: Game, late: NonNullable<Game['late']>) => {
  const d = SCORING.disputed;
  const chances = late.loserChanceBefore6 !== undefined && late.loserChanceAfter6 !== undefined;
  const door = closeFinalMargin(g) || closeByClutch(g) || late.clutchSeconds > 0
    || (late.marginAt6 !== undefined && late.marginAt6 <= d.maxMarginAt6)
    || (chances && (late.loserChanceAfter6! >= d.lateChance || late.loserChanceBefore6! >= d.doubtChance))
    // Without the chances (a game rated before November 10): the comeback door, as before
    || (!chances && loserBiggestLead(g) >= d.minLoserBiggestLead);
  return door && loserBelieved(late);
};

// A close game, from the full base. v1 (no play-by-play): close at the end or a big comeback.
const closeGame = (g: Game) =>
  g.late !== undefined
    ? closeLate(g, g.late)
    : closeFinalMargin(g) || loserBiggestLead(g) >= SCORING.disputed.minLoserBiggestLead;

// v1 only (no play-by-play, so no clutch nor margin at 6:00): close after three quarters, lower base.
const q3Only = (g: Game) => g.late === undefined && marginAfterQ3(g) <= SCORING.disputed.maxMarginAfterQ3;

export const isDisputed = (g: Game) => closeGame(g) || q3Only(g);

export const disputedBaseFor = (g: Game) => (closeGame(g) ? SCORING.disputedBase : SCORING.q3OnlyBase);

// --- Step 2: refine -------------------------------------------------------------

export const pointsPer48 = (g: Game) => {
  const f = finalScore(g);
  return ((f.home + f.away) * 48) / (48 + 5 * overtimes(g));
};

// Each ingredient: its share (0 to 1) and its points. Detailed for scripts/explain.ts.
export const competitivenessDetails = (g: Game) => {
  const { suspense, scenario, comeback, offense } = SCORING;
  const { clutch, swings } = SCORING;
  const share = {
    // v2: time spent within 5 points at the end, instead of the final margin (often inflated by late free throws)
    suspense: g.late
      ? clamp01(g.late.clutchSeconds / clutch.fullAt)
      : clamp01((suspense.zeroAt - regulationMargin(g)) / (suspense.zeroAt - suspense.fullAt)),
    // v2: late lead changes count more than early ones
    scenario: g.late
      ? clamp01(g.late.weightedSwings / swings.fullAt)
      : clamp01((g.leadChanges + g.timesTied) / scenario.fullAt),
    comeback: clamp01(loserBiggestLead(g) / comeback.fullAt),
    offense: clamp01((pointsPer48(g) - offense.zeroAt) / (offense.fullAt - offense.zeroAt)),
  };
  return {
    suspense: { share: share.suspense, points: suspense.weight * share.suspense },
    scenario: { share: share.scenario, points: scenario.weight * share.scenario },
    comeback: {
      share: share.comeback,
      points: comeback.weight * share.comeback + comeback.bonusPerPoint * Math.max(0, loserBiggestLead(g) - comeback.fullAt),
    },
    offense: { share: share.offense, points: offense.weight * share.offense },
  };
};

export const competitivenessPoints = (g: Game) =>
  sum(Object.values(competitivenessDetails(g)).map((d) => d.points));

// True shooting: points per scoring attempt, free throws included (league average around 57-58%)
export const trueShooting = (p: PlayerLine) => {
  const attempts = 2 * (p.fga + 0.44 * p.fta);
  return attempts > 0 ? p.pts / attempts : 0;
};

// One player's points: nothing below the threshold, then the square of what's above it. On his efficiency,
// or on his points minus a gap when that's higher: a big scoring night counts even with many misses. Scored
// cleanly (true shooting at efficientTs or more), no gap: the points count in full.
export const playerPoints = (p: PlayerLine) => {
  const { threshold, divisor, pointsGap, efficientTs } = SCORING.performance;
  const gap = trueShooting(p) >= efficientTs ? 0 : pointsGap;
  return Math.max(0, Math.max(efficiency(p), p.pts - gap) - threshold) ** 2 / divisor;
};

export const performancePoints = (g: Game) => sum(g.players.map(playerPoints));

// --- Final rating ---------------------------------------------------------------

// Raw rating: used for ranking (can exceed 100).
export const rawScore = (g: Game) => {
  const points = competitivenessPoints(g) + performancePoints(g);
  return isDisputed(g)
    ? disputedBaseFor(g) + points
    : Math.min(SCORING.blowoutMax, points);
};

// Displayed rating: rounded and capped at 100.
export const displayScore = (g: Game) => Math.min(100, Math.round(rawScore(g)));
