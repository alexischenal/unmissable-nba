// scripts/nba/clutch.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buzzerAt, buzzerBeater, computeClutch, lateFrom, loserChances, marginAt6, parseClock, readPlayByPlay, swings, toTimeline, weightedSwings, type Timeline } from './clutch.ts';

test('clock: "PT04M32.00S" is 272 seconds', () => {
  assert.equal(parseClock('PT04M32.00S'), 272);
  assert.equal(parseClock('PT00M00.50S'), 0.5);
});

test('a blowout has no clutch time', () => {
  const t: Timeline = [[1, 700, 2, 0], [4, 400, 100, 80], [4, 30, 110, 88]];
  assert.deepEqual(computeClutch(t, 4), { seconds: 0, lateChanges: 0, marginAt2: 20, lastChangeAt: null });
});

test('ATL@ORL-like: one point at 2:00, decided late, 7 at the buzzer', () => {
  const t: Timeline = [
    [4, 400, 118, 117], // home up 1 before the window
    [4, 250, 118, 120], // away takes the lead (Q4 4:10)
    [4, 130, 121, 122], // margin 1
    [4, 100, 121, 125], // away up 4
    [4, 70, 121, 128],  // up 7: out of clutch
    [4, 20, 125, 132],
  ];
  const c = computeClutch(t, 4);
  assert.equal(c.seconds, 300 - 70); // within 5 from 5:00 down to 1:10
  assert.equal(c.lateChanges, 1);
  assert.equal(c.marginAt2, 1);
  assert.equal(c.lastChangeAt, 'Q4 4:10');
});

test('overtime counts whole (it lasts 5 minutes)', () => {
  const t: Timeline = [[4, 10, 100, 100], [5, 200, 104, 102], [5, 5, 108, 105]];
  const c = computeClutch(t, 5);
  assert.equal(c.seconds, 300 + 300); // tied through the end of Q4's window, then within 5 for all of OT1
});

test('the play-by-play is reduced to score changes, and a bad format fails loudly', () => {
  const pbp = { game: { gameId: 'x', actions: [
    { period: 1, clock: 'PT12M00.00S', scoreHome: '0', scoreAway: '0' },
    { period: 1, clock: 'PT11M40.00S', scoreHome: '2', scoreAway: '0' },
    { period: 1, clock: 'PT11M20.00S', scoreHome: '2', scoreAway: '0' },
  ] } };
  assert.deepEqual(toTimeline(pbp), [[1, 700, 2, 0]]);
  // With the scorer, when the NBA gives it
  const withScorer = { game: { gameId: 'x', actions: [{ period: 1, clock: 'PT11M40.00S', scoreHome: '0', scoreAway: '3', personId: 201939 }] } };
  assert.deepEqual(toTimeline(withScorer as never), [[1, 700, 0, 3, 201939]]);
  assert.throws(() => toTimeline({ game: { gameId: 'x', actions: [{ clock: 'x' }] } } as never));
});

test('lead changes and ties are counted like the box score', () => {
  // 2-0 home, 2-2 tie, 2-4 away (a change, through the tie), 6-4 home (a change)
  const t: Timeline = [[1, 700, 2, 0], [1, 680, 2, 2], [1, 660, 2, 4], [2, 600, 6, 4]];
  assert.deepEqual(swings(t).map((w) => w.kind), ['tie', 'change', 'change']);
  // Weights: two in Q1, one in Q2
  assert.equal(weightedSwings(t, { fullAt: 1, q1: 0.5, q2: 0.75, q3: 1, q4: 1.25, late: 2 }), 1.75);
});

test('buzzer: the last action time, or null when the play-by-play has none', () => {
  const action = (timeActual?: string) => ({ period: 4, clock: 'PT00M00.00S', scoreHome: '100', scoreAway: '98', ...(timeActual ? { timeActual } : {}) });
  assert.equal(buzzerAt({ game: { gameId: 'x', actions: [action('2026-10-24T01:00:00Z'), action('2026-10-24T02:58:30.4Z')] } }), Date.parse('2026-10-24T02:58:30.4Z'));
  assert.equal(buzzerAt({ game: { gameId: 'x', actions: [action()] } }), null);
});

test('a correction added after the game, at the end of the list, is left out', () => {
  // Like MEM@GSW (October 23): the last action is a Q2 play, with its score of the time
  const act = (period: number, clock: string, home: number, away: number, timeActual: string) =>
    ({ period, clock, scoreHome: String(home), scoreAway: String(away), timeActual });
  const pbp = { game: { gameId: 'x', actions: [
    act(1, 'PT11M40.00S', 2, 0, '2026-10-24T02:10:00Z'),
    act(2, 'PT05M00.00S', 34, 33, '2026-10-24T02:50:00Z'),
    act(4, 'PT00M01.20S', 108, 109, '2026-10-24T04:45:00Z'),
    act(4, 'PT00M00.00S', 108, 111, '2026-10-24T04:46:00Z'),
    act(2, 'PT04M58.00S', 33, 34, '2026-10-24T05:02:00Z'),
  ] } };
  const timeline = toTimeline(pbp);
  assert.deepEqual(timeline[timeline.length - 1], [4, 0, 108, 111]);
  assert.equal(buzzerAt(pbp), Date.parse('2026-10-24T04:46:00Z'));
});

test('readPlayByPlay: the v2 data when complete, the reason when not', () => {
  const act = (period: number, clock: string, home: number, away: number) =>
    ({ period, clock, scoreHome: String(home), scoreAway: String(away), timeActual: '2026-10-27T02:00:00Z' });
  const game = {
    home: 'CLE', away: 'MIN', leadChanges: 0, timesTied: 0, biggestLead: { home: 2, away: 0 }, players: [],
    periods: [{ home: 2, away: 0 }, { home: 0, away: 0 }, { home: 0, away: 0 }, { home: 0, away: 0 }],
  };
  const done = readPlayByPlay({ game: { gameId: 'x', actions: [act(1, 'PT11M00.00S', 2, 0), act(4, 'PT00M00.00S', 2, 0)] } }, game);
  assert.ok(done.late);
  assert.equal(done.buzzer, Date.parse('2026-10-27T02:00:00Z'));
  const early = readPlayByPlay({ game: { gameId: 'x', actions: [act(1, 'PT11M00.00S', 0, 0)] } }, game);
  assert.equal(early.late, undefined);
  assert.match(early.problem ?? '', /not complete yet/);
});

test('buzzer beater: the last basket at 0.0 that wins, or ties to force overtime', () => {
  // A 3 at 0.0 from 1 down: wins
  assert.equal(buzzerBeater([[4, 20, 100, 101, 1], [4, 0, 103, 101, 7]], 4), 7);
  // With 0.3 left: a game-winner, not a buzzer beater
  assert.equal(buzzerBeater([[4, 20, 100, 101, 1], [4, 0.3, 103, 101, 7]], 4), undefined);
  // Free throws at 0.0 after a foul at the buzzer: not a basket
  assert.equal(buzzerBeater([[4, 20, 100, 100, 1], [4, 0, 101, 100, 7]], 4), undefined);
  // Already ahead: a basket at the buzzer that changes nothing
  assert.equal(buzzerBeater([[4, 20, 104, 100, 1], [4, 0, 106, 100, 7]], 4), undefined);
  // Ties at the end of Q4, the game goes on: counted, even if overtime is won another way
  assert.equal(buzzerBeater([[4, 20, 97, 100, 1], [4, 0, 100, 100, 8], [5, 3, 109, 108, 9], [5, 0, 110, 108, 9]], 5), 8);
  // In lateFrom only when there is one
  assert.equal(lateFrom([[4, 20, 100, 101, 1], [4, 0, 103, 101, 7]], 4).buzzerBeater, 7);
  assert.equal('buzzerBeater' in lateFrom([[4, 20, 100, 101, 1], [4, 5, 103, 101, 7]], 4), false);
});

test('the margin with 6:00 left: the last score before 6:00 in the fourth', () => {
  const t: Timeline = [[3, 0, 70, 64], [4, 600, 80, 66], [4, 400, 82, 77], [4, 300, 100, 77]];
  assert.equal(marginAt6(t), 5); // 14 at 10:00, then 5 at 6:40; the 23 at 5:00 is too late
  assert.equal(lateFrom(t, 4).marginAt6, 5);
});

test('the loser\'s best chances in the fourth, before and after 6:00', () => {
  // Home up 20 after Q3, the visitors back to 6 at 4:56, then pushed away: a 12-point win
  const t: Timeline = [[3, 0, 80, 60], [4, 500, 86, 74], [4, 296, 88, 82], [4, 200, 96, 82], [4, 0, 100, 88]];
  const c = loserChances(t);
  assert.ok(c.before6 > 0 && c.before6 < 0.1);   // down 12 at 8:20 at best
  assert.ok(c.after6 > 0.1 && c.after6 < 0.3);   // down 6 with 4:56 left
  assert.equal(lateFrom(t, 4).loserChanceAfter6, c.after6);
  // Tied at the end of regulation (overtime): at least a coin flip (here the loser even led with 0:30 left)
  assert.equal(loserChances([[4, 30, 100, 98], [4, 0, 100, 100], [5, 0, 109, 104]]).after6, 0.5);
  assert.ok(loserChances([[4, 30, 98, 100], [4, 0, 100, 100], [5, 0, 109, 104]]).after6 > 0.5);
});
