// scripts/nba/plan.test.ts — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentNight, planRun, type NightGame } from './plan.ts';

// Opening night 2026: Tuesday October 20 (US), tip-offs at 3 p.m., 7 p.m. and 9:30 p.m. ET (UTC-4).
const OPENING: NightGame[] = [
  { tipOff: '2026-10-20T19:00:00Z' },
  { tipOff: '2026-10-20T23:00:00Z' },
  { tipOff: '2026-10-21T01:30:00Z' },
];
const schedule: Record<string, NightGame[]> = { '2026-10-20': OPENING };
const gamesOn = (d: string) => schedule[d] ?? [];
const nothingPublished = () => false;
const at = (iso: string) => new Date(iso);

test('the night starts at 6 a.m. in New York', () => {
  assert.equal(currentNight(at('2026-10-21T09:59:00Z')), '2026-10-20'); // 05:59 ET
  assert.equal(currentNight(at('2026-10-21T10:00:00Z')), '2026-10-21'); // 06:00 ET
});

test('Tuesday noon in Paris: no game yet → wait, no box score calls', () => {
  const plan = planRun(at('2026-10-20T10:00:00Z'), gamesOn, nothingPublished);
  assert.equal(plan.action, 'wait');
});

test('Tuesday 9 p.m. in Paris: first game on, last one not tipped off → wait', () => {
  const plan = planRun(at('2026-10-20T19:15:00Z'), gamesOn, nothingPublished);
  assert.deepEqual(plan.action, 'wait');
});

test('Wednesday 3:45 a.m. in Paris: all games tipped off → process the night', () => {
  const plan = planRun(at('2026-10-21T01:45:00Z'), gamesOn, nothingPublished);
  assert.deepEqual(plan, { action: 'process', date: '2026-10-20' });
});

test('once published, later runs stay idle', () => {
  const plan = planRun(at('2026-10-21T05:00:00Z'), gamesOn, (d) => d === '2026-10-20');
  assert.equal(plan.action, 'idle');
});

test('a night still unpublished the next day gets caught up', () => {
  const plan = planRun(at('2026-10-21T15:00:00Z'), gamesOn, nothingPublished);
  assert.deepEqual(plan, { action: 'process', date: '2026-10-20' });
});

test('a day without games is skipped: the site keeps the last night', () => {
  const plan = planRun(at('2026-10-19T15:00:00Z'), gamesOn, nothingPublished);
  assert.equal(plan.action, 'idle');
});

test('missing tip-off times: fall back to asking the NBA', () => {
  const plan = planRun(at('2026-10-20T12:00:00Z'), () => [{ tipOff: undefined }], nothingPublished);
  assert.equal(plan.action, 'process');
});
