// src/lib/why.ts
// The "why" indicators of a rated game: shown under the flame next to its percentage.
// Only the individual nights, never a name, a team or a number. Nothing about the story of the game
// (comeback, close finish, lead changes…): knowing which one counted would tell the whole story.

import { SCORING } from '../config/scoring.ts';
import type { Game } from '../types/game.ts';
import type { Why } from '../types/public.ts';
import { efficiency } from './scoring.ts';

export function whyOf(g: Game): Why | undefined {
  const w = SCORING.why;
  const lines = g.players.map((p) => ({ eff: efficiency(p), pts: p.pts }));
  // Three tiers, each player in one only. Huge and crazy by efficiency; big also by points: a scorer who had
  // to take every shot still had a big night, even if his misses pull his efficiency down.
  const crazy = lines.filter(({ eff }) => eff >= w.crazyNight).length;
  const huge = lines.filter(({ eff }) => eff >= w.hugeNight && eff < w.crazyNight).length;
  const big = lines.filter(({ eff, pts }) => eff < w.hugeNight && (eff >= w.bigNight || pts >= w.bigPoints)).length;
  const why: Why = {
    ...(crazy ? { crazy } : {}),
    ...(huge ? { huge } : {}),
    ...(big ? { big } : {}),
  };
  return Object.keys(why).length ? why : undefined;
}

export type WhyChip = { label: string; heat?: 'big' | 'huge' | 'crazy' };

// The chips, in display order: "Crazy performance", "Huge performance ×2", "Big performance".
// Each carries a heat level: the card shows them on fire, lightly to fully. A "scenario" key (nights rated
// before November 1) is ignored: those cards only keep their flame when they had a performance.
export function whyChips(why: Why): WhyChip[] {
  const times = (n: number) => (n > 1 ? ` ×${n}` : '');
  return [
    ...(why.crazy ? [{ label: `Crazy performance${times(why.crazy)}`, heat: 'crazy' as const }] : []),
    ...(why.huge ? [{ label: `Huge performance${times(why.huge)}`, heat: 'huge' as const }] : []),
    ...(why.big ? [{ label: `Big performance${times(why.big)}`, heat: 'big' as const }] : []),
  ];
}

export const whyLabels = (why: Why): string[] => whyChips(why).map((c) => c.label);
