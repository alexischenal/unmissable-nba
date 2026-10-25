// scripts/nba/clutch.ts
import { SCORING } from '../../src/config/scoring.ts';
import type { Game } from '../../src/types/game.ts';

// "Clutch", the NBA's own definition: the last 5 minutes of the 4th quarter or of an overtime,
// with the margin at 5 points or less. Measured from the play-by-play (every action, with the clock
// and the score), reduced to a score timeline. Used by season-stats to compare with the final margin.

// [period, seconds left in the period, home score, away score], in game order, one per score change
export type ScoreEvent = [number, number, number, number];
export type Timeline = ScoreEvent[];

export type RawPlayByPlay = {
  game: { gameId: string; actions: { period: number; clock: string; scoreHome: string; scoreAway: string }[] };
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

// The play-by-play reduced to its score changes. Fails loudly on an unexpected format.
export function toTimeline(pbp: RawPlayByPlay): Timeline {
  const actions = pbp?.game?.actions;
  if (!Array.isArray(actions) || actions.length === 0) throw new Error('Unexpected play-by-play: no game.actions');
  const out: Timeline = [];
  let home = 0, away = 0;
  for (const a of actions) {
    if (typeof a.period !== 'number' || a.scoreHome === undefined || a.scoreAway === undefined) {
      throw new Error(`Unexpected play-by-play action: ${JSON.stringify(a).slice(0, 300)}`);
    }
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

// The biggest deficit a team came back from, to within `within` points (one possession: 3),
// whoever won in the end. 0 if no team ever got back within that margin after trailing.
export function erasedDeficit(timeline: Timeline, within = 3): number {
  let worstHome = 0, worstAway = 0; // biggest deficit so far, for each team
  let erased = 0;
  for (const [, , h, a] of timeline) {
    worstHome = Math.max(worstHome, a - h);
    worstAway = Math.max(worstAway, h - a);
    if (a - h <= within) erased = Math.max(erased, worstHome);
    if (h - a <= within) erased = Math.max(erased, worstAway);
  }
  return erased;
}

// The play-by-play is complete when its last score is the box score's final score
export function timelineMatches(timeline: Timeline, home: number, away: number): boolean {
  const last = timeline[timeline.length - 1];
  return last !== undefined && last[2] === home && last[3] === away;
}
