// scripts/nba/schedule-cache.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSchedule, nightsKept, trimSchedule } from './schedule-cache.ts';
import type { RawSchedule } from './types.ts';

const day = (mmddyyyy: string) => ({ gameDate: `${mmddyyyy} 00:00:00`, games: [] });
const FULL: RawSchedule = {
  leagueSchedule: {
    seasonYear: '2026-27',
    gameDates: ['10/19/2026', '10/20/2026', '10/21/2026', '10/22/2026', '10/23/2026', '10/24/2026'].map(day),
  },
};

test('keeps the previous night, the current one and the next two', () => {
  assert.deepEqual(nightsKept('2026-10-21'), ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
  const kept = trimSchedule(FULL, '2026-10-21').leagueSchedule.gameDates.map((d) => d.gameDate.slice(0, 10));
  assert.deepEqual(kept, ['10/20/2026', '10/21/2026', '10/22/2026', '10/23/2026']);
});

test('a copy of the current night is used without calling nba.com', async () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'schedule-')), 'schedule.json');
  const schedule = trimSchedule(FULL, '2026-10-21');
  writeFileSync(file, JSON.stringify({ night: '2026-10-21', schedule }));
  // 2026-10-21 at 20:00 UTC = 4 p.m. in New York: the night of October 21
  const loaded = await loadSchedule(new Date('2026-10-21T20:00:00Z'), file);
  assert.deepEqual(loaded, schedule);
});
