// src/main.ts
// Loads the night's JSON and renders one card per game.
// The front end never sees a score: it only receives the teams and the rating.

import { TEAMS, type Team } from './config/teams.ts';
import type { NightJson, PublicGame } from './types/public.ts';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FALLBACK_TEAM: Team = { location: '', name: '?', primary: '#5C5A55', secondary: '#141414' };

// Break point (soft hyphen) for a single-word name that is too long:
// "TIMBER- / WOLVES" on two lines, at the same size as the other names.
const SOFT_BREAKS: Record<string, string> = {
  Timberwolves: 'Timber­wolves',
};

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
async function loadNight(): Promise<NightJson> {
  const requested = new URLSearchParams(window.location.search).get('date');
  const file = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? `${requested}.json` : 'latest.json';
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  const json = (await res.json()) as NightJson;
  if (json.version !== 1 || !Array.isArray(json.games)) throw new Error('Unknown data format');
  return json;
}

function fillSide(side: HTMLElement, abbr: string): Team {
  const team = TEAMS[abbr] ?? { ...FALLBACK_TEAM, name: abbr };
  side.style.setProperty('--primary', team.primary);
  side.style.setProperty('--secondary', team.secondary);
  side.querySelector('.card__abbr')!.textContent = abbr;
  side.querySelector('.card__location')!.textContent = team.location;
  side.querySelector('.card__name')!.textContent = SOFT_BREAKS[team.name] ?? team.name;
  return team;
}

function renderCard(template: HTMLTemplateElement, game: PublicGame, index: number): DocumentFragment {
  const fragment = template.content.cloneNode(true) as DocumentFragment;
  const card = fragment.querySelector<HTMLElement>('.card')!;

  // Fixed order and symmetric styling: away on the left, home on the right,
  // whatever the result (otherwise the layout would spoil the winner).
  const away = fillSide(card.querySelector('.card__side--away')!, game.away);
  const home = fillSide(card.querySelector('.card__side--home')!, game.home);

  card.querySelector('.card__note-value')!.textContent = String(game.note);
  card.classList.toggle('card--featured', index === 0);
  card.setAttribute(
    'aria-label',
    `${index + 1}. ${away.location} ${away.name} at ${home.location} ${home.name}, rated ${game.note} out of 100`,
  );
  return fragment;
}

async function main(): Promise<void> {
  const status = document.getElementById('status')!;
  const list = document.getElementById('games')!;
  const label = document.getElementById('night-label')!;
  const template = document.getElementById('card-template') as HTMLTemplateElement;

  try {
    const night = await loadNight();
    label.textContent = nightLabel(night.date);

    if (night.games.length === 0) {
      status.textContent = 'No games last night. Come back tomorrow morning.';
      return;
    }

    list.replaceChildren(...night.games.map((g, i) => renderCard(template, g, i)));
    status.hidden = true;
  } catch (error) {
    console.error(error);
    status.textContent = "Last night's games aren't available yet. Try again in a little while.";
  }
}

void main();
