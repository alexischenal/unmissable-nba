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

export const isDisputed = (g: Game) => {
  const c = SCORING.disputed;
  return (
    regulationMargin(g) <= c.maxRegulationMargin ||
    marginAfterQ3(g) <= c.maxMarginAfterQ3 ||
    loserBiggestLead(g) >= c.minLoserBiggestLead
  );
};

// --- Step 2: refine -------------------------------------------------------------

export const competitivenessPoints = (g: Game) => {
  const { suspense, scenario, comeback, offense } = SCORING;

  const s = clamp01((suspense.zeroAt - regulationMargin(g)) / (suspense.zeroAt - suspense.fullAt));
  const sc = clamp01((g.leadChanges + g.timesTied) / scenario.fullAt);
  const cb = clamp01(loserBiggestLead(g) / comeback.fullAt);

  const f = finalScore(g);
  const minutes = 48 + 5 * overtimes(g);
  const per48 = ((f.home + f.away) * 48) / minutes;
  const off = clamp01((per48 - offense.zeroAt) / (offense.fullAt - offense.zeroAt));

  return suspense.weight * s + scenario.weight * sc + comeback.weight * cb + offense.weight * off;
};

export const performancePoints = (g: Game) => {
  const { threshold, divisor } = SCORING.performance;
  return sum(g.players.map((p) => Math.max(0, efficiency(p) - threshold) ** 2 / divisor));
};

// --- Final rating ---------------------------------------------------------------

// Raw rating: used for ranking (can exceed 100).
export const rawScore = (g: Game) => {
  const points = competitivenessPoints(g) + performancePoints(g);
  return isDisputed(g)
    ? SCORING.disputedBase + points
    : Math.min(SCORING.blowoutMax, points);
};

// Displayed rating: rounded and capped at 100.
export const displayScore = (g: Game) => Math.min(100, Math.round(rawScore(g)));
