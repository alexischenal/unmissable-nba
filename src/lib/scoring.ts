// src/lib/scoring.ts
// Pure functions: same input, same rating. Easy to test.

import { SCORING } from '../config/scoring.ts';
import type { Game, PlayerLine } from '../types/game.ts';

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

// Close at the end, or a big comeback: the game stayed alive until the end.
const closeToTheEnd = (g: Game) => {
  const c = SCORING.disputed;
  return regulationMargin(g) <= c.maxRegulationMargin || loserBiggestLead(g) >= c.minLoserBiggestLead
    || closeByClutch(g);
};

export const isDisputed = (g: Game) =>
  closeToTheEnd(g) || marginAfterQ3(g) <= SCORING.disputed.maxMarginAfterQ3;

// Where a competitive game starts: lower when it was only close after Q3, then decided in the fourth.
export const disputedBaseFor = (g: Game) =>
  closeToTheEnd(g) ? SCORING.disputedBase : SCORING.q3OnlyBase;

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

// One player's points: nothing below the threshold, then the square of what's above it.
export const playerPoints = (p: PlayerLine) => {
  const { threshold, divisor } = SCORING.performance;
  return Math.max(0, efficiency(p) - threshold) ** 2 / divisor;
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
