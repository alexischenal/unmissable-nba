// scripts/nba/clutch-rating.ts
// The rating with the play-by-play (the "v2" being evaluated), shared by season-stats and explain.
// Not used by the site yet.

import { SCORING } from '../../src/config/scoring.ts';
import {
  competitivenessDetails, competitivenessPoints, disputedBaseFor, isDisputed, performancePoints,
} from '../../src/lib/scoring.ts';
import type { Game } from '../../src/types/game.ts';
import type { Clutch } from './clutch.ts';

// Step 1 with the clutch: a game is also close if it had at least 3 minutes of clutch, or was within
// 5 points with 2:00 left (whatever the final margin). Such a game starts from the full base.
// (60 s was tested first: it rescued blowouts with one tight minute before a team pulled away.)
export const CLUTCH_CLOSE_SECONDS = 180;
export const CLUTCH_CLOSE_MARGIN_AT_2 = 5;
export const closeByClutch = (c: Clutch) => c.seconds >= CLUTCH_CLOSE_SECONDS || c.marginAt2 <= CLUTCH_CLOSE_MARGIN_AT_2;

// The same rating, with the suspense taken from the clutch time instead of the final margin
// (full suspense points at 5 minutes of clutch, overtimes included).
//   A: only the suspense changes.
//   B: A, and the clutch also counts in step 1 (close game or blowout).
//   C: B, and the scenario counts lead changes and ties weighted by when they happened
//      (SWING_WEIGHTS), full at scenarioFullAt (calibrated to keep today's share of games at the max).
export type Pbp = { clutch: Clutch; weighted: number; count: number };
export function rawWithClutch(g: Game, x: Pbp, variant: 'A' | 'B' | 'C', scenarioFullAt = 1): number {
  const c = x.clutch;
  const d = competitivenessDetails(g);
  const suspense = SCORING.suspense.weight * Math.min(1, c.seconds / 300);
  const scenario = variant === 'C' ? SCORING.scenario.weight * Math.min(1, x.weighted / scenarioFullAt) : d.scenario.points;
  const points = competitivenessPoints(g) - d.suspense.points - d.scenario.points + suspense + scenario + performancePoints(g);
  if (variant !== 'A' && closeByClutch(c)) return SCORING.disputedBase + points;
  return isDisputed(g) ? disputedBaseFor(g) + points : Math.min(SCORING.blowoutMax, points);
}


// C's "full at", calibrated on 2025-26 (season-stats --clutch: same share of close games at the max as today)
export const SCENARIO_FULL_AT_2025_26 = 26;
