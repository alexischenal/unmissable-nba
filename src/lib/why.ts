// src/lib/why.ts
// The "why" indicators of a rated game: shown under the "?" next to its percentage.
// Only what kind of game it was, never a name, a team, a number or how it ends
// (no "overtime": it would say the game is tied after regulation).

import { SCORING } from '../config/scoring.ts';
import type { Game } from '../types/game.ts';
import type { Why } from '../types/public.ts';
import { closeByClutch, competitivenessPoints, efficiency, loserBiggestLead, regulationMargin } from './scoring.ts';

// "Scenario" by rules, not only by a total: a tight finish or a big comeback ALWAYS get it, whatever
// the rest of the game (the same tests as step 1 of the rating, so the tag can't disagree with it).
export function hasScenario(g: Game): boolean {
  const w = SCORING.why;
  // Without the play-by-play (v1): no clutch time, the final margin stands in, like the v1 suspense
  const tightFinish = g.late ? closeByClutch(g) : regulationMargin(g) <= SCORING.suspense.fullAt;
  const bigComeback = loserBiggestLead(g) >= SCORING.disputed.minLoserBiggestLead;
  const backAndForth = g.late !== undefined && g.late.weightedSwings >= w.scenarioSwings;
  return tightFinish || bigComeback || backAndForth || competitivenessPoints(g) >= w.scenarioPoints;
}

export function whyOf(g: Game): Why | undefined {
  const w = SCORING.why;
  const effs = g.players.map(efficiency);
  // Three tiers, each player in one only
  const crazy = effs.filter((e) => e >= w.crazyNight).length;
  const huge = effs.filter((e) => e >= w.hugeNight && e < w.crazyNight).length;
  const big = effs.filter((e) => e >= w.bigNight && e < w.hugeNight).length;
  const why: Why = {
    ...(hasScenario(g) ? { scenario: true as const } : {}),
    ...(crazy ? { crazy } : {}),
    ...(huge ? { huge } : {}),
    ...(big ? { big } : {}),
  };
  return Object.keys(why).length ? why : undefined;
}

// The chips, in display order: "Scenario", "Crazy night", "Huge night ×2", "Big night"
export function whyLabels(why: Why): string[] {
  const times = (n: number) => (n > 1 ? ` ×${n}` : '');
  return [
    ...(why.scenario ? ['Scenario'] : []),
    ...(why.crazy ? [`Crazy night${times(why.crazy)}`] : []),
    ...(why.huge ? [`Huge night${times(why.huge)}`] : []),
    ...(why.big ? [`Big night${times(why.big)}`] : []),
  ];
}
