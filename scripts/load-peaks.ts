// scripts/load-peaks.ts
// The personal peaks (see src/config/peaks.ts): the PLAYER_PEAKS secret on GitHub Actions, or
// player-peaks.secret.json locally. Missing: the personal door stays shut, the rest works as usual.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { usePeaks } from '../src/config/peaks.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadPeaks(): boolean {
  const fromEnv = process.env.PLAYER_PEAKS;
  if (fromEnv) {
    usePeaks(JSON.parse(fromEnv), 'PLAYER_PEAKS secret');
    console.log('Personal peaks: loaded (PLAYER_PEAKS).');
    return true;
  }
  const localFile = path.join(ROOT, 'player-peaks.secret.json');
  if (existsSync(localFile)) {
    usePeaks(JSON.parse(readFileSync(localFile, 'utf8')), 'player-peaks.secret.json');
    console.log('Personal peaks: loaded (player-peaks.secret.json).');
    return true;
  }
  console.warn('Personal peaks: none (no PLAYER_PEAKS, no player-peaks.secret.json): the personal door is shut.');
  return false;
}
