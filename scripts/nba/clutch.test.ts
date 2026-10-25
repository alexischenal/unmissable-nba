// scripts/nba/clutch.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeClutch, erasedDeficit, parseClock, swings, toTimeline, weightedSwings, type Timeline } from './clutch.ts';

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
  assert.throws(() => toTimeline({ game: { gameId: 'x', actions: [{ clock: 'x' }] } } as never));
});

test('lead changes and ties are counted like the box score', () => {
  // 2-0 home, 2-2 tie, 2-4 away (a change, through the tie), 6-4 home (a change)
  const t: Timeline = [[1, 700, 2, 0], [1, 680, 2, 2], [1, 660, 2, 4], [2, 600, 6, 4]];
  assert.deepEqual(swings(t).map((w) => w.kind), ['tie', 'change', 'change']);
  // Weights: two in Q1, one in Q2
  assert.equal(weightedSwings(t, { fullAt: 1, q1: 0.5, q2: 0.75, q3: 1, q4: 1.25, late: 2 }), 1.75);
});

test('comeback within one possession: counted whoever won', () => {
  // Away down 20, back to 2, then loses by 10: the 20 counts
  const held: Timeline = [[1, 600, 20, 0], [3, 300, 60, 58], [4, 0, 100, 90]];
  assert.equal(erasedDeficit(held), 20);
  // Away down 20, never back within 3: nothing
  const never: Timeline = [[1, 600, 20, 0], [3, 300, 60, 54], [4, 0, 100, 80]];
  assert.equal(erasedDeficit(never), 0);
  // Home down 15, comes back and wins: the 15 counts
  const won: Timeline = [[1, 600, 0, 15], [4, 60, 90, 90], [4, 0, 95, 90]];
  assert.equal(erasedDeficit(won), 15);
});
