// src/config/scoring.ts
// Every setting of the algorithm. To tune the ratings, this is the only file to edit.
// Principle: the rating only measures what happened on the court, never who was playing.

export const SCORING = {
  // Step 1: a game is "competitive" if at least one condition is true
  disputed: {
    maxRegulationMargin: 10, // margin at the end of regulation
    maxMarginAfterQ3: 5,     // margin at the end of the 3rd quarter
    minLoserBiggestLead: 12, // biggest lead of the losing team (comeback)
  },

  // Rating ranges
  disputedBase: 50, // a competitive game starts at 50, uncapped (display capped at 100)
  blowoutMax: 49,   // a blowout stays a blowout, even if someone scores 80

  // Step 2: competitiveness and entertainment (30 points in total)
  suspense:  { weight: 12, fullAt: 3, zeroAt: 15 },    // margin at the end of regulation
  scenario:  { weight: 6,  fullAt: 20 },               // lead changes + times tied
  comeback:  { weight: 6,  fullAt: 15 },               // biggest lead of the loser
  offense:   { weight: 6,  zeroAt: 210, fullAt: 260 }, // total points per 48 minutes

  // Step 2: individual performances (uncapped)
  performance: {
    threshold: 30, // efficiency from which a player counts
    divisor: 20,   // points = (eff − threshold)² / divisor ; larger = less weight
  },
} as const;
