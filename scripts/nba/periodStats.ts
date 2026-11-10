// scripts/nba/periodStats.ts
// Each player's stat line in each period, from the full play-by-play: to tell what a player did before
// the fourth quarter (a night that made the blowout, or stats padded once the game was over).
// Checked against the box score: the periods must add up to the game's line.

import { efficiency } from '../../src/lib/scoring.ts';
import type { Game, PlayerLine } from '../../src/types/game.ts';

// [pts, reb, ast, stl, blk, fgm, fga, ftm, fta, tov], one per period (index 0 = Q1)
export type PeriodLine = [number, number, number, number, number, number, number, number, number, number];
export type PeriodStats = Record<string, PeriodLine[]>; // personId → periods

type RawAction = {
  period: number; clock: string; actionType?: string; subType?: string; personId?: number; shotResult?: string;
  assistPersonId?: number; stealPersonId?: number; blockPersonId?: number;
};

const empty = (): PeriodLine => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const PTS = 0, REB = 1, AST = 2, STL = 3, BLK = 4, FGM = 5, FGA = 6, FTM = 7, FTA = 8, TOV = 9;

export function periodStats(raw: unknown): PeriodStats {
  const actions = (raw as { game?: { actions?: RawAction[] } })?.game?.actions;
  if (!Array.isArray(actions) || actions.length === 0) throw new Error('Unexpected play-by-play: no game.actions');
  if (!actions.some((a) => typeof a.actionType === 'string')) throw new Error('Unexpected play-by-play: no actionType');
  const out: PeriodStats = {};
  const add = (id: number | undefined, period: number, stat: number, n = 1) => {
    if (typeof id !== 'number' || id <= 0 || period < 1) return;
    const lines = (out[String(id)] ??= []);
    while (lines.length < period) lines.push(empty());
    const line = lines[period - 1]!;
    line[stat] = line[stat]! + n;
  };
  // Steals and blocks: their own actions when the feed has them, else on the turnover / the missed shot
  const ownSteals = actions.some((a) => a.actionType === 'steal');
  const ownBlocks = actions.some((a) => a.actionType === 'block');
  for (const a of actions) {
    if (typeof a.clock !== 'string' || !/^PT\d+M[\d.]+S$/.test(a.clock)) throw new Error(`Unexpected play-by-play clock: ${JSON.stringify(a.clock)}`);
    const t = a.actionType;
    const made = a.shotResult === 'Made';
    if (t === '2pt' || t === '3pt') {
      add(a.personId, a.period, FGA);
      if (made) {
        add(a.personId, a.period, FGM);
        add(a.personId, a.period, PTS, t === '3pt' ? 3 : 2);
        add(a.assistPersonId, a.period, AST);
      } else if (!ownBlocks) add(a.blockPersonId, a.period, BLK);
    } else if (t === 'freethrow') {
      add(a.personId, a.period, FTA);
      if (made) { add(a.personId, a.period, FTM); add(a.personId, a.period, PTS); }
    } else if (t === 'rebound') add(a.personId, a.period, REB);
    else if (t === 'turnover') {
      add(a.personId, a.period, TOV);
      if (!ownSteals) add(a.stealPersonId, a.period, STL);
    } else if (t === 'steal') add(a.personId, a.period, STL);
    else if (t === 'block') add(a.personId, a.period, BLK);
  }
  return out;
}

// A player's line over periods [from, to] (1-based, inclusive), as a PlayerLine for efficiency()
export function lineOver(stats: PeriodStats, p: PlayerLine, from: number, to: number): PlayerLine | undefined {
  const lines = p.id !== undefined ? stats[String(p.id)] : undefined;
  if (!lines) return undefined;
  const s = empty();
  for (let i = from - 1; i < Math.min(to, lines.length); i++) for (let k = 0; k < s.length; k++) s[k] = s[k]! + lines[i]![k]!;
  return {
    team: p.team, name: p.name, id: p.id,
    pts: s[PTS], reb: s[REB], ast: s[AST], stl: s[STL], blk: s[BLK], fgm: s[FGM], fga: s[FGA], ftm: s[FTM], fta: s[FTA], tov: s[TOV],
  };
}

// The periods added up, compared with the box score: which stats differ (empty when everything matches)
export function mismatches(stats: PeriodStats, p: PlayerLine): string[] {
  const all = lineOver(stats, p, 1, 99) ?? lineOver({ [String(p.id)]: [empty()] }, p, 1, 1)!;
  const keys = ['pts', 'reb', 'ast', 'stl', 'blk', 'fgm', 'fga', 'ftm', 'fta', 'tov'] as const;
  return keys.filter((k) => all[k] !== p[k]).map((k) => `${k} ${all[k]}/${p[k]}`);
}

// What each player did in the first three quarters (Game.late.firstThree): points and efficiency, for
// the players of the box score who have a personId
export function firstThreeQuarters(stats: PeriodStats, game: Game): NonNullable<NonNullable<Game['late']>['firstThree']> {
  return game.players.flatMap((p) => {
    const line = lineOver(stats, p, 1, 3);
    return line && p.id !== undefined ? [{ id: p.id, pts: line.pts, eff: efficiency(line) }] : [];
  });
}
