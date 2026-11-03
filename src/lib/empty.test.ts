// src/lib/empty.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyNightDate, isEmptyNow, staleAt } from './empty.ts';
import type { NightJson } from '../types/public.ts';

// Monday night's games (last tip-off 02:30 UTC Tuesday), nothing on Tuesday, then Wednesday's
const monday: NightJson = {
  version: 2, date: '2026-11-02',
  games: [{ away: 'BOS', home: 'NYK', tipOff: '2026-11-03T00:00:00Z', note: 60 }, { away: 'DEN', home: 'LAL', tipOff: '2026-11-03T02:30:00Z', note: 40 }],
};
const wednesday: NightJson = { version: 2, date: '2026-11-04', games: [{ away: 'SAS', home: 'DEN', tipOff: '2026-11-05T00:00:00Z' }] };
const at = (iso: string) => Date.parse(iso);

test('empty: Monday night stays "last night" for a day, 27 h after its last tip-off', () => {
  assert.equal(staleAt(monday), at('2026-11-04T05:30:00Z'));
  assert.equal(isEmptyNow(monday, wednesday, at('2026-11-03T09:00:00Z')), false); // Tuesday morning
  assert.equal(isEmptyNow(monday, wednesday, at('2026-11-04T05:29:00Z')), false);
});

test('empty: from Wednesday morning until the first tip-off of Wednesday night', () => {
  assert.equal(isEmptyNow(monday, wednesday, at('2026-11-04T07:00:00Z')), true);
  assert.equal(isEmptyNow(monday, wednesday, at('2026-11-04T23:59:00Z')), true);
  assert.equal(isEmptyNow(monday, wednesday, at('2026-11-05T00:00:00Z')), false); // the new night starts
  assert.equal(emptyNightDate(monday, wednesday), '2026-11-03');
});

test('empty: off-season, no next night: the empty screen stays', () => {
  assert.equal(isEmptyNow(monday, null, at('2026-12-01T12:00:00Z')), true);
  assert.equal(emptyNightDate(monday, null), '2026-11-03');
});

test('empty: an old file without tip-off times goes stale the day after next, at noon UTC', () => {
  const old: NightJson = { version: 1, date: '2026-10-20', games: [{ away: 'BOS', home: 'NYK', note: 50 }] };
  assert.equal(staleAt(old), at('2026-10-22T12:00:00Z'));
});
