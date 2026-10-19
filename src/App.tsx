// src/App.tsx
// The page: header, the night's games (best first), footer.

import { MatchCard } from './components/MatchCard.tsx';
import { useNight } from './hooks/useNight.ts';
import { nightLabel } from './lib/night.ts';
import { gameState, nightIsComplete } from './types/public.ts';

// Card states are computed once, at page load: no card changes under the visitor's eyes.
const LOADED_AT = Date.now();

export function App() {
  const state = useNight();
  const night = state.status === 'ready' ? state.night : null;
  const complete = night !== null && nightIsComplete(night);

  let status: string | null = null;
  if (state.status === 'loading') status = 'Loading games…';
  else if (state.status === 'error') status = "Last night's games aren't available yet. Try again in a little while.";
  else if (night?.games.length === 0) status = 'No games last night. Come back tomorrow morning.';

  return (
    <main className="page">
      <header className="header">
        <div className="header__title">
          <p className="header__brand">Unmissable</p>
          <h1 className="header__heading">What to watch this morning</h1>
        </div>
        <p className="header__night">{night ? nightLabel(night.date) : '\u00A0'}</p>
      </header>

      <p className="page__status" role="status" hidden={status === null}>{status}</p>

      <ol className="games" aria-label="Last night's games, most recommended first">
        {night?.games.map((game, i) => (
          <li className="games__item" key={`${game.away}@${game.home}`}>
            <MatchCard
              game={game}
              state={gameState(game, LOADED_AT)}
              rank={i + 1}
              // A 100 is featured right away; otherwise the best game, once the whole night is rated.
              featured={game.note === 100 || (complete && i === 0)}
            />
          </li>
        ))}
      </ol>

      <footer className="page__footer">
        Not affiliated with the NBA. Ratings only measure what happened on the court.
      </footer>
    </main>
  );
}
