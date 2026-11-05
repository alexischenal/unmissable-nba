// scripts/player-peaks.ts
// Builds player-peaks.secret.json: each player's top 1% (efficiency and points) over every game in
// .cache/boxscores (all the seasons downloaded), for the personal door of the spicy rock. Local only,
// never committed (it tells the rule). Then paste the file into the PLAYER_PEAKS secret on GitHub.
// Once a season, before the first night (with the season that just ended downloaded): thresholds stay
// fixed for the whole season.
//
// Usage: npm run player-peaks -- --eff <floor> --pts <floor>
//   (the floors of the door: the night must reach them as well as the player's top 1%)

import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { efficiency } from '../src/lib/scoring.ts';
import type { Game, PlayerLine } from '../src/types/game.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_GAMES = 60; // fewer games: no personal bar (rookies, players back from far)
const TOP = 0.01;

// A player who took part (a line full of zeros is a player who didn't play)
const played = (p: PlayerLine) => p.pts + p.reb + p.ast + p.stl + p.blk + p.fga + p.fta + p.tov > 0;
// The value at his top 1%: with 300 games, his 3rd best
const topOf = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(s.length * (1 - TOP)) - 1)]!;
};

async function main(): Promise<void> {
  if (process.env.GITHUB_ACTIONS === 'true') throw new Error('player-peaks tells the rule: never on GitHub Actions (public logs).');
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(name);
    const v = i >= 0 ? Number(args[i + 1]) : NaN;
    if (!Number.isFinite(v)) throw new Error('Usage: npm run player-peaks -- --eff <floor> --pts <floor>');
    return v;
  };
  const eff = arg('--eff'), pts = arg('--pts');

  const root = path.join(ROOT, '.cache', 'boxscores');
  const seasons = existsSync(root) ? (await readdir(root)).filter((s) => /^\d{4}-\d{2}$/.test(s)).sort() : [];
  if (seasons.length === 0) throw new Error('No box score in .cache/boxscores: run npm run season-stats -- <season> first.');

  const lines = new Map<number, { eff: number[]; pts: number[] }>();
  let games = 0;
  for (const season of seasons) {
    const dir = path.join(root, season);
    for (const f of (await readdir(dir)).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as Game;
      games++;
      for (const p of g.players) {
        if (p.id === undefined || !played(p)) continue;
        const l = lines.get(p.id) ?? { eff: [], pts: [] };
        l.eff.push(efficiency(p));
        l.pts.push(p.pts);
        lines.set(p.id, l);
      }
    }
  }

  const players: Record<string, [number, number]> = {};
  for (const [id, l] of lines) {
    if (l.eff.length >= MIN_GAMES) players[id] = [topOf(l.eff), topOf(l.pts)];
  }
  const json = JSON.stringify({ eff, pts, players });
  await writeFile(path.join(ROOT, 'player-peaks.secret.json'), json + '\n');
  console.log(`Seasons: ${seasons.join(', ')} (${games} games).`);
  console.log(`player-peaks.secret.json: ${Object.keys(players).length} players with ${MIN_GAMES}+ games, ${(json.length / 1024).toFixed(1)} KB (a GitHub secret holds 48 KB).`);
  console.log('Next: paste the whole file into the PLAYER_PEAKS secret (Settings → Secrets and variables → Actions).');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
