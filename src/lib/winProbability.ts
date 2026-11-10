// src/lib/winProbability.ts
// The chance that the home team wins, from the margin and the time left (Stern, 1994): the margin moves
// like a random walk with a small home edge, so P(home wins) = Φ((margin + edge·τ) / (σ·√τ)), τ = the
// share of the game left. Fitted on seven seasons (scripts/wp-study.ts): well calibrated, and refitted
// each season. Used to tell whether the losing team could still believe in it (src/lib/scoring.ts).

export const GAME_SECONDS = 2880; // 48 minutes

export type WinProbabilityModel = { homeEdge: number; sigma: number };

// Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7)
export function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
    * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// margin: home − away; secondsLeft: in regulation (0 at the end of the fourth)
export function homeWinProbability(margin: number, secondsLeft: number, m: WinProbabilityModel): number {
  const tau = secondsLeft / GAME_SECONDS;
  if (tau <= 0) return margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
  return phi((margin + m.homeEdge * tau) / (m.sigma * Math.sqrt(tau)));
}

// The chance of a team down `deficit` with `secondsLeft` to play, at home or away: the lower of the two
// (the bar a door sets must hold for both)
export function trailingChance(deficit: number, secondsLeft: number, m: WinProbabilityModel): number {
  return Math.min(homeWinProbability(-deficit, secondsLeft, m), 1 - homeWinProbability(deficit, secondsLeft, m));
}
