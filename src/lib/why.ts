// src/lib/why.ts
// The "why" indicators of a rated game: shown under the flame next to its percentage.
// Only the individual nights, never a name, a team or a number. Nothing about the story of the game
// (comeback, close finish, lead changes…): knowing which one counted would tell the whole story.

import { PEAKS } from '../config/peaks.ts';
import { SCORING } from '../config/scoring.ts';
import type { Game, PlayerLine } from '../types/game.ts';
import type { Why } from '../types/public.ts';
import { displayScore, efficiency } from './scoring.ts';

// A quadruple-double: 10 or more in four of points, rebounds, assists, steals, blocks
const quadrupleDouble = (p: PlayerLine) => [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length >= 4;

export function whyOf(g: Game): Why | undefined {
  const w = SCORING.why;
  // The spicy rock says "watch it": only in a competitive game (rated above the blowout cap). In a blowout,
  // a historic night keeps its flame and its Crazy chip.
  const competitive = displayScore(g) > SCORING.blowoutMax;
  // A duel: two players (or more) in the same game, each at nuclearDuel efficiency or scoring
  // nuclearDuelPoints (one can score, the other fill the box score): all of them are nuclear
  const duelist = (p: PlayerLine) => efficiency(p) >= w.nuclearDuel || p.pts >= w.nuclearDuelPoints;
  const duel = g.players.filter(duelist).length >= 2;
  // A big performance (a flame) capped by a buzzer beater that wins the game or forces overtime
  const buzzer = (p: PlayerLine) => p.id !== undefined && p.id === g.late?.buzzerBeater
    && (efficiency(p) >= w.bigNight || p.pts >= w.bigPoints);
  // A personal peak: in the player's own top 1% (src/config/peaks.ts) and above an absolute floor, on
  // efficiency or on points (the same stat for both). A player without a bar yet (a rookie, too few games):
  // the floors alone.
  const peaks = PEAKS();
  const peak = (p: PlayerLine) => {
    if (!peaks || p.id === undefined) return false;
    const bar = peaks.players.get(p.id) ?? { eff: peaks.eff, pts: peaks.pts };
    const eff = efficiency(p);
    return (eff >= peaks.eff && eff >= bar.eff) || (p.pts >= peaks.pts && p.pts >= bar.pts);
  };
  const lines = g.players.map((p) => {
    const eff = efficiency(p);
    const nuclear = competitive
      && (p.pts >= w.nuclearPoints || eff >= w.nuclearEff || quadrupleDouble(p) || (p.fg3m ?? 0) >= w.nuclearThrees
        || (duel && duelist(p)) || buzzer(p) || peak(p));
    return { eff, pts: p.pts, nuclear };
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

// spoken: what screen readers say instead of the label, when the label doesn't read well aloud
export type WhyChip = { label: string; spoken?: string; heat?: 'big' | 'huge' | 'crazy' | 'nuclear' };

// The chips, in display order: "WTF???" alone when there is a rock (never counted on screen), otherwise
// "Crazy performance", "Huge performance ×2", "Big performance".
// Each carries a heat level: the card shows them on fire, lightly to fully. A "scenario" key (nights rated
// before November 1) is ignored: those cards only keep their flame when they had a performance.
export function whyChips(why: Why): WhyChip[] {
  const times = (n: number) => (n > 1 ? ` ×${n}` : '');
  // A spicy rock says it all: its chip alone, the other performances of the game aren't listed
  if (why.nuclear) {
    return [{ label: 'WTF???', spoken: why.nuclear > 1 ? `${why.nuclear} historic performances` : 'Historic performance', heat: 'nuclear' }];
  }
  return [
    ...(why.crazy ? [{ label: `Crazy performance${times(why.crazy)}`, heat: 'crazy' as const }] : []),
    ...(why.huge ? [{ label: `Huge performance${times(why.huge)}`, heat: 'huge' as const }] : []),
    ...(why.big ? [{ label: `Big performance${times(why.big)}`, heat: 'big' as const }] : []),
  ];
}

export const whyLabels = (why: Why): string[] => whyChips(why).map((c) => c.label);
