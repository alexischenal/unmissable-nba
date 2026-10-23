// scripts/explain.ts
// The detail of every rating of a night, for the developer only. Reads, never writes.
//
// The details say a lot about the settings: run it on your own machine, with scoring.secret.json,
// never on GitHub Actions (the logs of a public repo are public).
//
// Usage:
//   npm run explain -- 2026-10-20   → every game of that night that is over
//   npm run explain -- --fixture    → the fixtures of April 4, 2026, no network
//   npm run explain -- 2026-10-21 --v1     → the box score only (rating v1), no play-by-play

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchBoxscore, fetchPlayByPlay, fetchSchedule, pause } from './nba/client.ts';
import { lateFrom, timelineMatches, toTimeline, type RawPlayByPlay, type Timeline } from './nba/clutch.ts';
import { gamesOnDate, isFinal, toGame } from './nba/adapter.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import {
  closeByClutch, competitivenessDetails, competitivenessPoints, disputedBaseFor, displayScore, efficiency, finalScore, isDisputed,
  loserBiggestLead, marginAfterQ3, overtimes, performancePoints, playerPoints, pointsPer48, rawScore,
  regulationMargin,
} from '../src/lib/scoring.ts';
import type { Game } from '../src/types/game.ts';

const n1 = (x: number) => x.toFixed(1);
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
const check = (ok: boolean) => (ok ? 'yes' : 'no ');

function explain(g: Game): void {
  const c = SCORING.disputed;
  const f = finalScore(g);
  const ot = overtimes(g);
  const disputed = isDisputed(g);
  const compet = competitivenessDetails(g);
  const perfs = performancePoints(g);
  const raw = rawScore(g);

  console.log(`\n${g.away} ${f.away} @ ${g.home} ${f.home}${ot ? ` (${ot} OT)` : ''}   ${g.late ? 'v2 (play-by-play)' : 'v1 (box score only)'}`);
  console.log('-'.repeat(60));

  const q3Only = disputed && disputedBaseFor(g) !== SCORING.disputedBase;
  console.log(`Step 1 — close game? ${disputed ? (q3Only ? 'YES, only after Q3 (lower base)' : 'YES') : 'NO, blowout'}`);
  console.log(`  ${check(regulationMargin(g) <= c.maxRegulationMargin)}  margin end of regulation  ${regulationMargin(g)} (≤ ${c.maxRegulationMargin})`);
  console.log(`  ${check(marginAfterQ3(g) <= c.maxMarginAfterQ3)}  margin after Q3           ${marginAfterQ3(g)} (≤ ${c.maxMarginAfterQ3})`);
  console.log(`  ${check(loserBiggestLead(g) >= c.minLoserBiggestLead)}  loser's biggest lead      ${loserBiggestLead(g)} (≥ ${c.minLoserBiggestLead})`);
  if (g.late) {
    const k = SCORING.clutch;
    console.log(`  ${check(closeByClutch(g))}  tight finish              clutch ${g.late.clutchSeconds} s (≥ ${k.closeSeconds}) or margin at 2:00 ${g.late.marginAt2} (≤ ${k.closeMarginAt2})`);
  }

  console.log('Step 2 — competitiveness');
  const s = SCORING;
  const suspenseWhy = g.late
    ? `clutch ${g.late.clutchSeconds} s within 5 in the last 5 min + OT (full at ${s.clutch.fullAt} s)`
    : `margin ${regulationMargin(g)} (full at ${s.suspense.fullAt}, zero at ${s.suspense.zeroAt})`;
  const scenarioWhy = g.late
    ? `${g.leadChanges + g.timesTied} lead changes + ties, weighted ${g.late.weightedSwings} (full at ${s.swings.fullAt})`
    : `${g.leadChanges} lead changes + ${g.timesTied} ties (full at ${s.scenario.fullAt})`;
  console.log(`  suspense  ${pct(compet.suspense.share)}  ${n1(compet.suspense.points).padStart(5)} / ${s.suspense.weight}   ${suspenseWhy}`);
  console.log(`  scenario  ${pct(compet.scenario.share)}  ${n1(compet.scenario.points).padStart(5)} / ${s.scenario.weight}    ${scenarioWhy}`);
  console.log(`  comeback  ${pct(compet.comeback.share)}  ${n1(compet.comeback.points).padStart(5)} / ${s.comeback.weight}    loser led by ${loserBiggestLead(g)} (full at ${s.comeback.fullAt})`);
  console.log(`  offense   ${pct(compet.offense.share)}  ${n1(compet.offense.points).padStart(5)} / ${s.offense.weight}    ${n1(pointsPer48(g))} pts per 48 min (zero at ${s.offense.zeroAt}, full at ${s.offense.fullAt})`);
  console.log(`  total            ${n1(competitivenessPoints(g)).padStart(5)}`);

  console.log(`Step 2 — performances (efficiency above ${s.performance.threshold}, squared, ÷ ${s.performance.divisor})`);
  const stars = g.players
    .map((p) => ({ p, eff: efficiency(p), pts: playerPoints(p) }))
    .sort((a, b) => b.eff - a.eff);
  const counted = stars.filter((x) => x.pts > 0);
  for (const { p, eff, pts } of counted) {
    const team = p.team === 'home' ? g.home : g.away;
    console.log(`  ${(p.name ?? '?').padEnd(24)} ${team}  eff ${String(eff).padStart(3)}  → ${n1(pts).padStart(5)}   (${p.pts} pts ${p.reb} reb ${p.ast} ast)`);
  }
  if (counted.length === 0) {
    const best = stars[0];
    console.log(`  nobody above ${s.performance.threshold}${best ? ` (best: ${best.p.name ?? '?'}, eff ${best.eff})` : ''}`);
  }
  console.log(`  total            ${n1(perfs).padStart(5)}`);

  const base = disputed ? `${disputedBaseFor(g)} + ${n1(competitivenessPoints(g))} + ${n1(perfs)}`
    : `min(${s.blowoutMax}, ${n1(competitivenessPoints(g))} + ${n1(perfs)})`;
  console.log(`Rating: ${base} = ${n1(raw)} → ${displayScore(g)}`);
}

// A night of a past season, from the box scores (and play-by-play) cached by season-stats.
// Returns false when nothing is cached for that date.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function explainFromCache(date: string, v1Only: boolean): Promise<boolean> {
  const boxDir = path.join(ROOT, '.cache', 'boxscores');
  if (!existsSync(boxDir)) return false;
  const found: { game: Game & { id: string; date?: string }; season: string }[] = [];
  for (const season of await readdir(boxDir)) {
    for (const f of await readdir(path.join(boxDir, season))) {
      const game = JSON.parse(await readFile(path.join(boxDir, season, f), 'utf8')) as Game & { id: string; date?: string };
      if (game.date === date) found.push({ game, season });
    }
  }
  if (found.length === 0) return false;
  console.log(`${date}: ${found.length} game(s), from the season-stats cache`);
  for (const { game, season } of found) {
    const pbp = path.join(ROOT, '.cache', 'playbyplay', season, `${game.id}.json`);
    if (!v1Only && existsSync(pbp)) {
      const timeline = JSON.parse(await readFile(pbp, 'utf8')) as Timeline;
      const f = finalScore(game);
      if (timelineMatches(timeline, f.home, f.away)) game.late = lateFrom(timeline, game.periods.length);
    }
    explain(game);
  }
  return true;
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('explain prints the details of the settings: never on GitHub Actions (public logs).');
  }
  loadScoring();
  const args = process.argv.slice(2);

  if (args.includes('--fixture')) {
    const [{ sasAtDen }, { wasAtMia }, { detAtPhi }] = await Promise.all([
      import('../fixtures/2026-04-04-sas-den.ts'),
      import('../fixtures/2026-04-04-was-mia.ts'),
      import('../fixtures/2026-04-04-det-phi.ts'),
    ]);
    [sasAtDen, wasAtMia, detAtPhi].forEach(explain);
    return;
  }

  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (!date) throw new Error('Usage: npm run explain -- YYYY-MM-DD');

  const v1Only = args.includes('--v1');

  const scheduled = gamesOnDate(await fetchSchedule(), date);
  // Not in this season's schedule: a past season, from season-stats' cache
  if (scheduled.length === 0 && await explainFromCache(date, v1Only)) return;
  console.log(`${date}: ${scheduled.length} game(s)`);
  for (const g of scheduled) {
    const label = `${g.awayTeam.teamTricode}@${g.homeTeam.teamTricode}`;
    let box;
    try {
      box = await fetchBoxscore(g.gameId);
    } catch {
      console.log(`\n${label}: no box score (not started?)`);
      continue;
    }
    await pause(500);
    if (!isFinal(box)) {
      console.log(`\n${label}: not over, no rating.`);
      continue;
    }
    const game = toGame(box);
    // Rating v2, like the site: the play-by-play, when it's there and complete
    if (!v1Only) {
      try {
        const timeline = toTimeline(await fetchPlayByPlay(g.gameId) as RawPlayByPlay);
        const f = finalScore(game);
        if (timelineMatches(timeline, f.home, f.away)) game.late = lateFrom(timeline, game.periods.length);
        await pause(500);
      } catch {
        // No play-by-play: v1
      }
    }
    explain(game);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
