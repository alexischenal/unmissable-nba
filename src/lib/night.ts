// src/lib/night.ts
// Loading and labelling a night. No React here: plain functions, easy to test.
// The front end never sees a score: it only receives the teams and the rating.

import type { NightJson } from '../types/public.ts';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "October 20–21", "October 31 – November 1".
// short: "Oct 20–21", "Oct 31 – Nov 1", for phones (the long one wraps at 320px).
export function nightDates(isoDate: string, { short = false } = {}): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 1));
  const month = (x: Date) => {
    const name = MONTHS[x.getUTCMonth()]!;
    return short ? name.slice(0, 3) : name;
  };
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${month(start)} ${start.getUTCDate()}–${end.getUTCDate()}`
    : `${month(start)} ${start.getUTCDate()} – ${month(end)} ${end.getUTCDate()}`;
}

// "Night of October 20–21"
export const nightLabel = (isoDate: string, options: { short?: boolean } = {}): string =>
  `Night of ${nightDates(isoDate, options)}`;

// The pages. GitHub Pages serves /next, /how-it-works and /legal from their own index.html (copied at build
// time, see vite.config.ts): same app, it only reads the URL to know which page it is.
export type Page = 'home' | 'next' | 'about' | 'legal';
const PATH = window.location.pathname.replace(/\/+$/, '');
const PAGES: Record<string, Page> = { '/next': 'next', '/how-it-works': 'about', '/legal': 'legal' };
export const PAGE: Page = PAGES[PATH] ?? 'home';
export const HOME_URL = '/';
// With the slash: GitHub Pages would redirect /next to /next/
export const NEXT_URL = '/next/';
export const ABOUT_URL = '/how-it-works/';
export const LEGAL_URL = '/legal/';

async function loadFile(file: string, signal?: AbortSignal): Promise<NightJson | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache', signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  const json = (await res.json()) as NightJson;
  if ((json.version !== 1 && json.version !== 2) || !Array.isArray(json.games)) throw new Error('Unknown data format');
  return json;
}

// The home page night: the latest published one by default; ?date=2026-04-04 for a specific night.
export async function loadNight(signal?: AbortSignal): Promise<NightJson> {
  const requested = new URLSearchParams(window.location.search).get('date');
  const file = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? `${requested}.json` : 'latest.json';
  const night = await loadFile(file, signal);
  if (!night) throw new Error(`${file} not found`);
  return night;
}

// The next calendar night, or null when it has no games (no "Next" link then).
export async function loadNextNight(signal?: AbortSignal): Promise<NightJson | null> {
  const night = await loadFile('next.json', signal);
  return night && night.games.length > 0 ? night : null;
}
