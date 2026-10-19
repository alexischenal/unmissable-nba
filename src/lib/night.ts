// src/lib/night.ts
// Loading and labelling a night. No React here: plain functions, easy to test.
// The front end never sees a score: it only receives the teams and the rating.

import type { NightJson } from '../types/public.ts';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "Night of October 20–21", "Night of October 31 – November 1"
export function nightLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(Date.UTC(y, m - 1, d + 1));
  const month = (x: Date) => MONTHS[x.getUTCMonth()];
  return start.getUTCMonth() === end.getUTCMonth()
    ? `Night of ${month(start)} ${start.getUTCDate()}–${end.getUTCDate()}`
    : `Night of ${month(start)} ${start.getUTCDate()} – ${month(end)} ${end.getUTCDate()}`;
}

// Latest published night by default; ?date=2026-04-04 for a specific night.
export async function loadNight(signal?: AbortSignal): Promise<NightJson> {
  const requested = new URLSearchParams(window.location.search).get('date');
  const file = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? `${requested}.json` : 'latest.json';
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache', signal });
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  const json = (await res.json()) as NightJson;
  if ((json.version !== 1 && json.version !== 2) || !Array.isArray(json.games)) throw new Error('Unknown data format');
  return json;
}
