// src/config/peaks.ts
// The personal peaks: each player's top 1% (efficiency, points) over his past games, and the absolute
// floors of the door. Not in the repo: they'd tell the rule. Built locally by npm run player-peaks, then
// stored in the PLAYER_PEAKS secret on GitHub Actions (player-peaks.secret.json locally).
// Without them, the personal door is simply shut.

export type Peaks = {
  eff: number; // floor: the night must reach this efficiency (on the efficiency side)…
  pts: number; // …or this many points (on the points side)
  players: Map<number, { eff: number; pts: number }>; // personId → his top 1%
};

let peaks: Peaks | null = null;

export const PEAKS = (): Peaks | null => peaks;

// The file: { "eff": 50, "pts": 48, "players": { "203999": [61, 47], … } } ([efficiency, points])
export function usePeaks(json: unknown, label = 'peaks'): void {
  if (json === null) { peaks = null; return; }
  const o = json as { eff?: unknown; pts?: unknown; players?: unknown };
  const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (!finite(o.eff) || !finite(o.pts)) throw new Error(`${label}: "eff" and "pts" must be numbers`);
  if (typeof o.players !== 'object' || o.players === null) throw new Error(`${label}: "players" must be an object`);
  const players = new Map<number, { eff: number; pts: number }>();
  for (const [id, v] of Object.entries(o.players)) {
    if (!Array.isArray(v) || v.length !== 2 || !finite(v[0]) || !finite(v[1]) || !/^\d+$/.test(id)) {
      throw new Error(`${label}: bad entry for player ${id}`);
    }
    players.set(Number(id), { eff: v[0], pts: v[1] });
  }
  peaks = { eff: o.eff, pts: o.pts, players };
}
