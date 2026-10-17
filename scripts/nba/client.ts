// scripts/nba/client.ts
// HTTP calls to nba.com's public JSON files.
// Server side only: the public site never calls them.

import type { RawBoxscore, RawSchedule } from './types.ts';

const SCHEDULE_URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
const boxscoreUrl = (gameId: string) =>
  `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

// Browser-like headers: some NBA servers reject requests without them.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
};

const TIMEOUT_MS = 20_000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} on ${url}`);
  return (await res.json()) as T;
}

export const fetchSchedule = () => getJson<RawSchedule>(SCHEDULE_URL);

export const fetchBoxscore = (gameId: string) => getJson<RawBoxscore>(boxscoreUrl(gameId));

// A short pause between two calls, to be polite to the server.
export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
