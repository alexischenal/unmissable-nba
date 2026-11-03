// src/lib/why.ts
// The "why" indicators of a rated game: shown under the flame next to its percentage.
// Only the individual nights, never a name, a team or a number. Nothing about the story of the game
// (comeback, close finish, lead changes…): knowing which one counted would tell the whole story.

import { SCORING } from '../config/scoring.ts';
import type { Game, PlayerLine } from '../types/game.ts';
import type { Why } from '../types/public.ts';
import { efficiency } from './scoring.ts';

// A quadruple-double: 10 or more in four of points, rebounds, assists, steals, blocks
const quadrupleDouble = (p: PlayerLine) => [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length >= 4;

export function whyOf(g: Game): Why | undefined {
  const w = SCORING.why;
  const lines = g.players.map((p) => {
    const eff = efficiency(p);
    return { eff, pts: p.pts, nuclear: p.pts >= w.nuclearPoints || eff >= w.nuclearEff || quadrupleDouble(p) };
  });
  // Four tiers, each player in one only. Nuclear first (never announced), then by efficiency; big also by
  // points: a scorer who had to take every shot still had a big night, even if his misses pull his
  // efficiency down.
  const nuclear = lines.filter((l) => l.nuclear).length;
  const rest = lines.filter((l) => !l.nuclear);
  const crazy = rest.filter(({ eff }) => eff >= w.crazyNight).length;
  const huge = rest.filter(({ eff }) => eff >= w.hugeNight && eff < w.crazyNight).length;
  const big = rest.filter(({ eff, pts }) => eff < w.hugeNight && (eff >= w.bigNight || pts >= w.bigPoints)).length;
  const why: Why = {
    ...(nuclear ? { nuclear } : {}),
    ...(crazy ? { crazy } : {}),
    ...(huge ? { huge } : {}),
    ...(big ? { big } : {}),
  };
  return Object.keys(why).length ? why : undefined;
}

export type WhyChip = { label: string; heat?: 'big' | 'huge' | 'crazy' | 'nuclear' };

// The chips, in display order: "Crazy performance", "Huge performance ×2", "Big performance".
// Each carries a heat level: the card shows them on fire, lightly to fully. A "scenario" key (nights rated
// before November 1) is ignored: those cards only keep their flame when they had a performance.
export function whyChips(why: Why): WhyChip[] {
  const times = (n: number) => (n > 1 ? ` ×${n}` : '');
  return [
    ...(why.nuclear ? [{ label: `WTF???${times(why.nuclear)}`, heat: 'nuclear' as const }] : []),
    ...(why.crazy ? [{ label: `Crazy performance${times(why.crazy)}`, heat: 'crazy' as const }] : []),
    ...(why.huge ? [{ label: `Huge performance${times(why.huge)}`, heat: 'huge' as const }] : []),
    ...(why.big ? [{ label: `Big performance${times(why.big)}`, heat: 'big' as const }] : []),
  ];
}

export const whyLabels = (why: Why): string[] => whyChips(why).map((c) => c.label);
