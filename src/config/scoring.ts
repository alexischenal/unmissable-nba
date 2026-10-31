// src/config/scoring.ts
// The settings of the algorithm. The code is public, the real values are not.
//
//   - EXAMPLE_SCORING below: placeholder values, plausible but NOT the ones used on the site.
//     Enough to run the tests, the fixtures and the demo.
//   - The real values come from outside the repo, read by the server script (scripts/fetch-night.ts):
//     the SCORING_CONFIG secret on GitHub Actions, or a local scoring.secret.json (ignored by Git).
//
// Principle: the rating only measures what happened on the court, never who was playing.

export type ScoringConfig = {
  // Step 1: a game is "competitive" if at least one condition is true
  disputed: {
    maxRegulationMargin: number; // margin at the end of regulation
    maxMarginAfterQ3: number;    // margin at the end of the 3rd quarter
    minLoserBiggestLead: number; // biggest lead of the losing team (comeback)
  };
  // Rating ranges
  disputedBase: number; // where a competitive game starts (uncapped, display capped at 100)
  // Where a game starts when it's competitive ONLY through the margin after Q3:
  // tight for three quarters, decided in the fourth. Lower than disputedBase.
  q3OnlyBase: number;
  blowoutMax: number;   // a blowout stays a blowout, even if someone scores 80
  // Step 2: competitiveness and entertainment
  suspense: { weight: number; fullAt: number; zeroAt: number }; // margin at the end of regulation
  scenario: { weight: number; fullAt: number };                 // lead changes + times tied
  // Biggest lead of the loser. Beyond fullAt, every extra point of lead brings bonusPerPoint, uncapped:
  // a historic comeback (29 points, CLE@PHI, October 22) must stand out from an ordinary big one.
  comeback: { weight: number; fullAt: number; bonusPerPoint: number };
  offense: { weight: number; zeroAt: number; fullAt: number };  // total points per 48 minutes
  // Step 2: individual performances (uncapped)
  performance: {
    threshold: number; // efficiency from which a player counts
    divisor: number;   // larger = less weight
  };
  // v2, with the play-by-play. Without it, the v1 fields above are used instead.
  clutch: {
    fullAt: number;         // suspense: seconds of clutch for the full points (replaces the final margin)
    closeSeconds: number;   // step 1: also a close game with that much clutch…
    closeMarginAt2: number; // …or within this margin with 2:00 left, whatever the final margin
  };
  // Scenario: lead changes and ties weighted by when they happened (replaces the plain count)
  swings: { fullAt: number; q1: number; q2: number; q3: number; q4: number; late: number };
  // The "why" indicators on the cards (src/lib/why.ts). A tight finish or a big comeback always gets
  // "Scenario"; these thresholds add the other intense games, and the individual nights.
  why: {
    scenarioPoints: number; // spectacle points (suspense + scenario + comeback + offense) for "Scenario"
    scenarioSwings: number; // weighted lead changes + ties for "Scenario"
    bigNight: number;       // efficiency for a "big night"
    hugeNight: number;      // efficiency for a "huge night"
    crazyNight: number;     // efficiency for a "crazy night" (the button gets a flame)
  };
};

// EXAMPLE VALUES — not the ones used on unmissable.watch.
export const EXAMPLE_SCORING: ScoringConfig = {
  disputed: { maxRegulationMargin: 12, maxMarginAfterQ3: 6, minLoserBiggestLead: 10 },
  disputedBase: 50,
  q3OnlyBase: 42,
  blowoutMax: 49,
  suspense: { weight: 10, fullAt: 2, zeroAt: 16 },
  scenario: { weight: 8, fullAt: 18 },
  comeback: { weight: 6, fullAt: 12, bonusPerPoint: 0.8 },
  offense: { weight: 6, zeroAt: 200, fullAt: 250 },
  performance: { threshold: 28, divisor: 25 },
  clutch: { fullAt: 240, closeSeconds: 150, closeMarginAt2: 4 },
  swings: { fullAt: 24, q1: 0.4, q2: 0.7, q3: 1, q4: 1.3, late: 2.2 },
  why: { scenarioPoints: 16, scenarioSwings: 16, bigNight: 37, hugeNight: 46, crazyNight: 56 },
};

// The settings in use. Starts with the examples; the server script replaces them with the real ones.
export const SCORING: ScoringConfig = structuredClone(EXAMPLE_SCORING);

// Replaces the settings in use. Every key of the example must be there, with a finite number:
// a typo in the secret must stop the script, not publish ratings computed with half the settings.
export function useScoring(config: unknown, label = 'scoring config'): void {
  const check = (ref: object, value: unknown, path: string): void => {
    if (typeof value !== 'object' || value === null) throw new Error(`${label}: "${path}" must be an object`);
    for (const [key, refValue] of Object.entries(ref)) {
      const v = (value as Record<string, unknown>)[key];
      const p = path ? `${path}.${key}` : key;
      if (typeof refValue === 'object') check(refValue, v, p);
      else if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${label}: "${p}" must be a number`);
    }
  };
  check(EXAMPLE_SCORING, config, '');
  Object.assign(SCORING, structuredClone(config as ScoringConfig));
}
