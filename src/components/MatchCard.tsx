// src/components/MatchCard.tsx
// One game: away team on the left, home team on the right, the rating in the middle.

import type { CSSProperties } from 'react';
import { TEAMS, type Team } from '../config/teams.ts';
import type { PublicGame } from '../types/public.ts';

const FALLBACK_TEAM: Team = { location: '', name: '?', primary: '#5C5A55', secondary: '#141414' };

// Break point (soft hyphen) for a single-word name that is too long:
// "TIMBER- / WOLVES" on two lines, at the same size as the other names.
const SOFT_BREAKS: Record<string, string> = {
  Timberwolves: 'Timber­wolves',
};

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

type MatchCardProps = { game: PublicGame; rank: number; featured: boolean };

export function MatchCard({ game, rank, featured }: MatchCardProps) {
  const away = teamFor(game.away);
  const home = teamFor(game.home);

  // Fixed order and symmetric styling: away on the left, home on the right,
  // whatever the result (otherwise the layout would spoil the winner).
  return (
    <article
      className={featured ? 'card card--featured' : 'card'}
      aria-label={`${rank}. ${away.location} ${away.name} at ${home.location} ${home.name}, rated ${game.note} out of 100`}
    >
      <TeamSide side="away" abbr={game.away} team={away} />
      <TeamSide side="home" abbr={game.home} team={home} />
      <div className="card__note" aria-hidden="true">
        <span className="card__note-value">{game.note}</span>
      </div>
    </article>
  );
}
