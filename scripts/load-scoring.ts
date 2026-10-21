// scripts/load-scoring.ts
// The real settings of the algorithm are not in the repo (see src/config/scoring.ts):
// the SCORING_CONFIG secret on GitHub Actions, or scoring.secret.json locally.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { useScoring } from '../src/config/scoring.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Returns true with the real settings, false with the example ones.
export function loadScoring(): boolean {
  const fromEnv = process.env.SCORING_CONFIG;
  if (fromEnv) {
    useScoring(JSON.parse(fromEnv), 'SCORING_CONFIG secret');
    console.log('Scoring: real settings (SCORING_CONFIG).');
    return true;
  }
  const localFile = path.join(ROOT, 'scoring.secret.json');
  if (existsSync(localFile)) {
    useScoring(JSON.parse(readFileSync(localFile, 'utf8')), 'scoring.secret.json');
    console.log('Scoring: real settings (scoring.secret.json).');
    return true;
  }
  // On GitHub, never publish ratings computed with the example values
  if (process.env.GITHUB_ACTIONS === 'true') {
    throw new Error('The SCORING_CONFIG secret is missing: nothing published.');
  }
  console.warn('Scoring: EXAMPLE settings (no SCORING_CONFIG, no scoring.secret.json). Ratings are not the real ones.');
  return false;
}
