// scripts/nba/clutch.ts
import { SCORING } from '../../src/config/scoring.ts';
import { finalScore } from '../../src/lib/scoring.ts';
import type { Game } from '../../src/types/game.ts';

// "Clutch", the NBA's own definition: the last 5 minutes of the 4th quarter or of an overtime,
// with the margin at 5 points or less. Measured from the play-by-play (every action, with the clock
// and the score), reduced to a score timeline. Used by season-stats to compare with the final margin.

// [period, seconds left in the period, home score, away score], in game order, one per score change
export type ScoreEvent = [number, number, number, number];
export type Timeline = ScoreEvent[];

export type RawPlayByPlay = {
  game: { gameId: string; actions: { period: number; clock: string; scoreHome: string; scoreAway: string; timeActual?: string }[] };
};

export type Clutch = {
  seconds: number;         // time spent within 5 points in the last 5 minutes of Q4 and of every overtime
  lateChanges: number;     // lead changes + ties in those minutes
  marginAt2: number;       // margin with 2:00 left in the 4th quarter
  lastChangeAt: string | null; // when the lead last changed hands ("Q4 0:41", "OT1 2:10"), null if never late
};

const WINDOW = 300; // last 5 minutes
const CLUTCH_MARGIN = 5;

// "PT04M32.00S" → 272
export function parseClock(clock: string): number {
  const m = /^PT(\d+)M([\d.]+)S$/.exec(clock);
  if (!m) throw new Error(`Unexpected play-by-play clock: ${JSON.stringify(clock)}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

type Action = RawPlayByPlay['game']['actions'][number];

// The actions in game order. The NBA can add a correction after the game, at the end of the list,
// with the score of the moment the play happened (seen on MEM@GSW, October 23: a last score of 33-34
// after a 111-108 final). Read in list order, it looked like the end of the game. Any action that goes
// back in the game (an earlier period, or more time left than the action before) is left out.
// A 1-second tolerance: actions logged on the same play can differ by a fraction of a second.
function inGameOrder(actions: Action[]): Action[] {
  const out: Action[] = [];
  let period = 0, left = Infinity;
  for (const a of actions) {
    if (typeof a.period !== 'number' || a.scoreHome === undefined || a.scoreAway === undefined) {
      throw new Error(`Unexpected play-by-play action: ${JSON.stringify(a).slice(0, 300)}`);
    }
    const s = parseClock(a.clock);
    if (a.period < period || (a.period === period && s > left + 1)) continue;
    if (a.period > period) left = Infinity;
    period = a.period;
    left = Math.min(left, s);
    out.push(a);
  }
  return out;
}

// The play-by-play reduced to its score changes, in game order. Fails loudly on an unexpected format.
export function toTimeline(pbp: RawPlayByPlay): Timeline {
  const actions = pbp?.game?.actions;
  if (!Array.isArray(actions) || actions.length === 0) throw new Error('Unexpected play-by-play: no game.actions');
  const out: Timeline = [];
  let home = 0, away = 0;
  for (const a of inGameOrder(actions)) {
    const h = Number(a.scoreHome), w = Number(a.scoreAway);
    if (h !== home || w !== away) {
      home = h; away = w;
      out.push([a.period, parseClock(a.clock), home, away]);
    }
  }
  return out;
}

const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const label = (period: number, s: number) =>
  `${period <= 4 ? `Q${period}` : `OT${period - 4}`} ${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export type Swing = { period: number; secondsLeft: number; kind: 'tie' | 'change' };

// Lead changes and ties, counted like the NBA's box score totals: a tie whenever the score becomes
// level (not 0-0), a lead change whenever a team leads after the other one did (even through a tie).
export function swings(timeline: Timeline): Swing[] {
  const out: Swing[] = [];
  let margin = 0;
  let lastLeader = 0;
  for (const [period, secondsLeft, h, a] of timeline) {
    const next = h - a;
    if (next === 0 && margin !== 0) out.push({ period, secondsLeft, kind: 'tie' });
    const leader = sign(next);
    if (leader !== 0) {
      if (lastLeader !== 0 && leader !== lastLeader) out.push({ period, secondsLeft, kind: 'change' });
      lastLeader = leader;
    }
    margin = next;
  }
  return out;
}

// In the last 5 minutes of Q4, or in an overtime
const isLate = (w: { period: number; secondsLeft: number }) => w.period >= 4 && w.secondsLeft <= WINDOW;

// Weighted by moment of the game (the weights are settings: SCORING.swings): early swings count less
export function weightedSwings(timeline: Timeline, w = SCORING.swings): number {
  return swings(timeline).reduce((sum, s) => sum + (
    isLate(s) ? w.late : s.period === 1 ? w.q1 : s.period === 2 ? w.q2 : s.period === 3 ? w.q3 : w.q4), 0);
}

export function computeClutch(timeline: Timeline, periods: number): Clutch {
  let seconds = 0, marginAt2 = 0;

  for (let p = 4; p <= periods; p++) {
    // Margin when the window opens: the last score before it
    let margin = 0;
    for (const [period, s, h, a] of timeline) {
      if (period < p || (period === p && s > WINDOW)) margin = h - a;
    }
    let t = WINDOW;
    let at2Set = false;
    for (const [period, s, h, a] of timeline) {
      if (period !== p || s > WINDOW) continue;
      if (p === 4 && !at2Set && s <= 120) { marginAt2 = Math.abs(margin); at2Set = true; }
      if (Math.abs(margin) <= CLUTCH_MARGIN) seconds += t - s;
      margin = h - a;
      t = s;
    }
    if (p === 4 && !at2Set) marginAt2 = Math.abs(margin);
    if (Math.abs(margin) <= CLUTCH_MARGIN) seconds += t;
  }

  const late = swings(timeline).filter(isLate);
  const lastChange = [...late].reverse().find((w) => w.kind === 'change');
  return {
    seconds: Math.round(seconds),
    lateChanges: late.length,
    marginAt2,
    lastChangeAt: lastChange ? label(lastChange.period, lastChange.secondsLeft) : null,
  };
}

// What the rating v2 reads from the play-by-play (Game.late)
export function lateFrom(timeline: Timeline, periods: number): NonNullable<Game['late']> {
  const c = computeClutch(timeline, periods);
  return { clutchSeconds: c.seconds, marginAt2: c.marginAt2, weightedSwings: weightedSwings(timeline) };
}

// When the game really ended (wall clock, ms): the last action's time in game order, the final buzzer.
// null when the play-by-play doesn't carry it: the delay is then just not shown.
export function buzzerAt(pbp: RawPlayByPlay): number | null {
  const actions = pbp?.game?.actions;
  if (!Array.isArray(actions) || actions.length === 0) return null;
  const ordered = inGameOrder(actions);
  const last = ordered[ordered.length - 1]?.timeActual;
  const t = last ? Date.parse(last) : NaN;
  return Number.isFinite(t) ? t : null;
}

// The play-by-play is complete when its last score is the box score's final score
export function timelineMatches(timeline: Timeline, home: number, away: number): boolean {
  const last = timeline[timeline.length - 1];
  return last !== undefined && last[2] === home && last[3] === away;
}

// Everything the rating needs from a play-by-play, in one place (fetch-night and explain):
// the v2 data when it's complete, otherwise why not. The buzzer comes either way, when known.
export type PlayByPlayRead =
  | { late: NonNullable<Game['late']>; buzzer: number | null; problem?: undefined }
  | { late?: undefined; buzzer: number | null; problem: string };

export function readPlayByPlay(pbp: RawPlayByPlay, game: Game): PlayByPlayRead {
  const timeline = toTimeline(pbp); // throws on an unexpected format
  const buzzer = buzzerAt(pbp);
  const f = finalScore(game);
  if (!timelineMatches(timeline, f.home, f.away)) {
    const last = timeline[timeline.length - 1];
    const seen = last ? `${last[3]}-${last[2]}` : 'none';
    return { buzzer, problem: `not complete yet: last score ${seen}, final ${f.away}-${f.home}` };
  }
  return { buzzer, late: lateFrom(timeline, game.periods.length) };
}
