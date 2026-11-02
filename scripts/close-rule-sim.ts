// scripts/close-rule-sim.ts
// Should "a final margin of 10 or less" still be enough for a close game? Garbage time moves the final margin
// both ways: a 22-point game after three quarters can end at 6. Simulates an extra condition, the margin with
// 2:00 left in the fourth (from the play-by-play), on a whole season, and lists the games that change.
// Local only: it prints how the settings behave (the logs of a public repo are public).
//
// Usage (after npm run season-stats -- 2025-26 --clutch, which fills .cache/):
//   npm run close-rule-sim -- 2025-26

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lateFrom, type Timeline } from './nba/clutch.ts';
import { loadScoring } from './load-scoring.ts';
import { SCORING } from '../src/config/scoring.ts';
import {
  closeByClutch, competitivenessPoints, displayScore, efficiency, loserBiggestLead, marginAfterQ3,
  performancePoints, regulationMargin,
} from '../src/lib/scoring.ts';
import type { Game } from '../src/types/game.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
type CachedGame = Game & { id: string; date?: string };

// The margin with 2:00 left that the final-margin rule would also need (null: the rule before November 2,
// "today" below). Adopted on November 2: the real maxMarginAt2, spare.
// "spare": the limit doesn't apply when the loser got within 5 at some point in the last 5 minutes
// (clutch time > 0): a real run that came close, even if the leader pulled away again before 2:00.
type Variant = { limit: number | null; spare: boolean };
const VARIANTS: Variant[] = [
  { limit: null, spare: false },
  { limit: 12, spare: false }, { limit: 10, spare: false }, { limit: 8, spare: false }, { limit: 6, spare: false },
  { limit: 10, spare: true }, { limit: 8, spare: true },
];
const name = (v: Variant) => (v.limit === null ? 'today' : `${v.limit}${v.spare ? ' spare' : ''}`);

const pct = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(0)}%` : '-');

// The rating with the variant: same as src/lib/scoring.ts, only the final-margin test changes
function rating(g: Game, v: Variant): number {
  const c = SCORING.disputed;
  const spared = v.spare && g.late !== undefined && g.late.clutchSeconds > 0;
  const finalOk = regulationMargin(g) <= c.maxRegulationMargin
    && (v.limit === null || spared || g.late === undefined || g.late.marginAt2 <= v.limit);
  const toTheEnd = finalOk || loserBiggestLead(g) >= c.minLoserBiggestLead || closeByClutch(g);
  const disputed = toTheEnd || marginAfterQ3(g) <= c.maxMarginAfterQ3;
  const points = competitivenessPoints(g) + performancePoints(g);
  const raw = disputed ? (toTheEnd ? SCORING.disputedBase : SCORING.q3OnlyBase) + points : Math.min(SCORING.blowoutMax, points);
  return Math.min(100, Math.round(raw));
}

function describe(g: CachedGame): string {
  const best = [...g.players].sort((a, b) => efficiency(b) - efficiency(a))[0];
  const late = g.late ? `at 2:00 ${String(g.late.marginAt2).padStart(2)} · within 5 for ${g.late.clutchSeconds} s` : 'no pbp';
  return `final ${String(regulationMargin(g)).padStart(2)} · Q3 ${String(marginAfterQ3(g)).padStart(2)} · ${late} · loser led ${String(loserBiggestLead(g)).padStart(2)}`
    + (best ? ` · best ${best.name ?? '?'} eff ${efficiency(best)} (${best.pts} pts)` : '');
}

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('close-rule-sim prints how the settings behave: never on GitHub Actions (public logs).');
  }
  const season = process.argv.slice(2).find((a) => /^\d{4}-\d{2}$/.test(a));
  if (!season) throw new Error('Usage: npm run close-rule-sim -- 2025-26');
  loadScoring();

  const dir = path.join(ROOT, '.cache', 'boxscores', season);
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) throw new Error(`No box score in ${dir}: run npm run season-stats -- ${season} --clutch first.`);
  const pbpDir = path.join(ROOT, '.cache', 'playbyplay', season);
  const games: CachedGame[] = [];
  for (const f of files) {
    const g = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as CachedGame;
    const pbp = path.join(pbpDir, f);
    games.push(existsSync(pbp) ? { ...g, late: lateFrom(JSON.parse(await readFile(pbp, 'utf8')) as Timeline, g.periods.length) } : g);
  }

  // Sanity check: the adopted variant (10, spare; real settings) must give the ratings of src/lib/scoring.ts.
  // "today" in the tables below is the rule before November 2.
  const adopted = { limit: SCORING.disputed.maxMarginAt2, spare: true };
  const mismatches = games.filter((g) => rating(g, adopted) !== displayScore(g)).length;
  console.log(`Close-game rule, ${season}: ${games.length} games. Check, the adopted rule vs the real rating: ${mismatches} mismatch(es) (must be 0).`);

  const today = new Map(games.map((g) => [g.id, rating(g, VARIANTS[0]!)]));
  console.log('\n=== Overview: final margin ≤ 10 also needs the margin at 2:00 ≤ limit ===');
  console.log('  limit    50%+   at 100%   games that move   lose 50%+   avg change of those');
  for (const v of VARIANTS) {
    const r = new Map(games.map((g) => [g.id, rating(g, v)]));
    const moved = games.filter((g) => r.get(g.id) !== today.get(g.id));
    const lost50 = moved.filter((g) => today.get(g.id)! >= 50 && r.get(g.id)! < 50).length;
    const avg = moved.length ? moved.reduce((s, g) => s + r.get(g.id)! - today.get(g.id)!, 0) / moved.length : 0;
    console.log(`  ${name(v).padEnd(8)}${pct(games.filter((g) => r.get(g.id)! >= 50).length, games.length).padStart(6)}   ${String(games.filter((g) => r.get(g.id)! >= 100).length).padStart(7)}   ${String(moved.length).padStart(15)}   ${String(lost50).padStart(9)}   ${moved.length ? avg.toFixed(1).padStart(19) : '-'.padStart(19)}`);
  }

  for (const v of VARIANTS.slice(1)) {
    const moved = games.filter((g) => rating(g, v) !== today.get(g.id)).sort((a, b) => today.get(b.id)! - today.get(a.id)!);
    console.log(`\n=== Limit ${name(v)}: the ${moved.length} games that move, best-rated first ===`);
    // Split: a late comeback to a small final margin (maybe a real finish) vs a garbage-time narrowing
    for (const [label, part] of [
      ['final margin 5 or less (a late run that nearly made it?)', moved.filter((g) => regulationMargin(g) <= 5)],
      ['final margin 6 to 10 (garbage time?)', moved.filter((g) => regulationMargin(g) > 5)],
    ] as const) {
      console.log(`  ${label}: ${part.length}`);
      for (const g of part.slice(0, 15)) {
        console.log(`    ${(g.date ?? '').padEnd(10)} ${`${g.away}@${g.home}`.padEnd(8)} ${String(today.get(g.id)).padStart(3)} → ${String(rating(g, v)).padStart(3)}   ${describe(g)}`);
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
