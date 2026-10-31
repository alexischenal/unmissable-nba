// src/components/MatchCard.tsx
// One game: away team on the left, home team on the right, and in the middle:
//   - upcoming → the tip-off time, in the visitor's own time zone and format;
//   - live     → nothing in the middle;
//   - rated    → the rating, and a "?" when there's something to say about it (src/lib/why.ts).

import { useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type Ref } from 'react';
import { TEAMS, type Team } from '../config/teams.ts';
import { cardColors, type Colors } from '../lib/colors.ts';
import { whyChips, type WhyChip } from '../lib/why.ts';
import type { GameState, PublicGame } from '../types/public.ts';

const FALLBACK_TEAM: Team = { location: '', name: '?', primary: '#5C5A55', secondary: '#141414' };

// Break point for a single-word name that is too long: "TIMBER / WOLVES" on two lines (no hyphen),
// at the same size as the other names. A zero-width space: invisible, and only breaks if needed.
const SOFT_BREAKS: Record<string, string> = {
  Timberwolves: 'Timber\u200Bwolves',
};

// The browser's locale and time zone: "21:00" in Paris, "3:00 PM" in New York.
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function teamFor(abbr: string): Team {
  return TEAMS[abbr] ?? { ...FALLBACK_TEAM, name: abbr };
}

type TeamSideProps = { side: 'away' | 'home'; abbr: string; team: Team; colors: Colors };

function TeamSide({ side, abbr, team, colors }: TeamSideProps) {
  const style = { '--primary': colors.primary, '--secondary': colors.secondary } as CSSProperties;
  return (
    <div className={`card__side card__side--${side}`} style={style}>
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
  const [whyOpen, setWhyOpen] = useState(false);
  const whyId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Several strips can be open at once, to compare. One folds back:
  //   - with its "?", or a click on its own card or strip;
  //   - with a click outside every card (the other cards and their strips leave it open);
  //   - with Escape.
  // On the full click, not on pointerdown like the menu: folding the strip moves the cards below,
  // and the release of a click would then land somewhere else.
  useEffect(() => {
    if (!whyOpen) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest?.('.card, .card__why')) return;
      setWhyOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const focused = document.activeElement;
      setWhyOpen(false);
      if (cardRef.current?.contains(focused) || stripRef.current?.contains(focused)) buttonRef.current?.focus();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [whyOpen]);
  // A click on the opened card (or its strip) folds it back; the "?" handles its own clicks.
  const foldOnClick = (event: ReactMouseEvent) => {
    if (whyOpen && !buttonRef.current?.contains(event.target as Node)) setWhyOpen(false);
  };
  const why = state === 'rated' && game.why ? whyChips(game.why) : [];
  const away = teamFor(game.away);
  const home = teamFor(game.home);
  // Two teams with the same color (PHI and NYK): one switches, so the diagonal stays visible
  const colors = cardColors(away, home);

  const classes = ['card', featured && 'card--featured', state !== 'rated' && `card--${state}`, whyOpen && 'card--why-open'];
  const teams = `${away.location} ${away.name} at ${home.location} ${home.name}`;
  const label =
    state === 'rated' ? `${rank}. ${teams}, rated ${game.note} out of 100`
    : state === 'live' ? `${teams}, in progress`
    : `${teams}, tip-off at ${game.tipOff ? TIME_FORMAT.format(new Date(game.tipOff)) : 'a time to be announced'}`;

  // Fixed order and symmetric styling: away on the left, home on the right,
  // whatever the result (otherwise the layout would spoil the winner).
  return (
    <>
      <article ref={cardRef} className={classes.filter(Boolean).join(' ')} aria-label={label} onClick={foldOnClick}>
        <TeamSide side="away" abbr={game.away} team={away} colors={colors.away} />
        <TeamSide side="home" abbr={game.home} team={home} colors={colors.home} />
        {/* In progress: no block in the middle at all */}
        {state !== 'live' && (
          <div className="card__note" aria-hidden="true">
            {state === 'rated' && (
              <span className="card__note-value">
                {game.note}
                <span className="card__note-unit">%</span>
              </span>
            )}
            {state === 'upcoming' && game.tipOff && <TipOff iso={game.tipOff} />}
          </div>
        )}
        {/* Only on the games with something to say: the card opens downwards, never a pop-up */}
        {why.length > 0 && (
          <button
            ref={buttonRef}
            type="button"
            className="card__why-button"
            aria-expanded={whyOpen}
            aria-controls={whyId}
            aria-label={`Why ${game.note}%?`}
            onClick={() => setWhyOpen((o) => !o)}
          >
            <svg className="card__why-icon" aria-hidden="true"><use href="/sprite.svg#flame" /></svg>
          </button>
        )}
      </article>
      {why.length > 0 && <WhyStrip ref={stripRef} id={whyId} open={whyOpen} note={game.note} chips={why} onClick={foldOnClick} />}
    </>
  );
}

// The strip under an opened card. The individual nights are on fire: lightly, more, fully.
// Only who opened the card sees it.
type WhyStripProps = {
  ref: Ref<HTMLDivElement>;
  id: string;
  open: boolean;
  note?: number;
  chips: WhyChip[];
  onClick: (event: ReactMouseEvent) => void;
};

function WhyStrip({ ref, id, open, note, chips, onClick }: WhyStripProps) {
  return (
    <div ref={ref} id={id} className="card__why" hidden={!open} onClick={onClick}>
      <span className="card__why-lead" aria-hidden="true">Why</span>
      <ul className="card__why-list" aria-label={`Why ${note}%`}>
        {chips.map(({ label, heat }) => (
          <li className={heat ? `card__why-chip card__why-chip--${heat}` : 'card__why-chip'} key={label}>{label}</li>
        ))}
      </ul>
    </div>
  );
}
