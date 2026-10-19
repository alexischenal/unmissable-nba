// src/components/MatchCard.tsx
// One game: away team on the left, home team on the right, and in the middle:
//   - upcoming → the tip-off time, in the visitor's own time zone and format;
//   - live     → nothing (the card is greyed out);
//   - rated    → the rating.

import type { CSSProperties } from 'react';
import { TEAMS, type Team } from '../config/teams.ts';
import type { GameState, PublicGame } from '../types/public.ts';

const FALLBACK_TEAM: Team = { location: '', name: '?', primary: '#5C5A55', secondary: '#141414' };

// Break point (soft hyphen) for a single-word name that is too long:
// "TIMBER- / WOLVES" on two lines, at the same size as the other names.
const SOFT_BREAKS: Record<string, string> = {
  Timberwolves: 'Timber­wolves',
};

// The browser's locale and time zone: "21:00" in Paris, "3:00 PM" in New York.
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function teamFor(abbr: string): Team {
  return TEAMS[abbr] ?? { ...FALLBACK_TEAM, name: abbr };
}

type TeamSideProps = { side: 'away' | 'home'; abbr: string; team: Team };

function TeamSide({ side, abbr, team }: TeamSideProps) {
  const colors = { '--primary': team.primary, '--secondary': team.secondary } as CSSProperties;
  return (
    <div className={`card__side card__side--${side}`} style={colors}>
      <span className="card__abbr" aria-hidden="true">{abbr}</span>
      <span className="card__location">{team.location}</span>
      <span className="card__name">{SOFT_BREAKS[team.name] ?? team.name}</span>
    </div>
  );
}

// "3:00 PM" → "3:00" + "PM" on its own line, so it fits the note box. "21:00" stays as is.
function TipOff({ iso }: { iso: string }) {
  const parts = TIME_FORMAT.formatToParts(new Date(iso));
  const period = parts.find((p) => p.type === 'dayPeriod')?.value;
  const time = parts.filter((p) => p.type !== 'dayPeriod').map((p) => p.value).join('').trim();
  return (
    <span className="card__note-value card__note-value--time">
      {time}
      {period && <span className="card__note-period">{period}</span>}
    </span>
  );
}

type MatchCardProps = { game: PublicGame; state: GameState; rank: number; featured: boolean };

export function MatchCard({ game, state, rank, featured }: MatchCardProps) {
  const away = teamFor(game.away);
  const home = teamFor(game.home);

  const classes = ['card', featured && 'card--featured', state !== 'rated' && `card--${state}`];
  const teams = `${away.location} ${away.name} at ${home.location} ${home.name}`;
  const label =
    state === 'rated' ? `${rank}. ${teams}, rated ${game.note} out of 100`
    : state === 'live' ? `${teams}, in progress`
    : `${teams}, tip-off at ${game.tipOff ? TIME_FORMAT.format(new Date(game.tipOff)) : 'a time to be announced'}`;

  // Fixed order and symmetric styling: away on the left, home on the right,
  // whatever the result (otherwise the layout would spoil the winner).
  return (
    <article className={classes.filter(Boolean).join(' ')} aria-label={label}>
      <TeamSide side="away" abbr={game.away} team={away} />
      <TeamSide side="home" abbr={game.home} team={home} />
      <div className="card__note" aria-hidden="true">
        {state === 'rated' && <span className="card__note-value">{game.note}</span>}
        {state === 'upcoming' && game.tipOff && <TipOff iso={game.tipOff} />}
      </div>
    </article>
  );
}
