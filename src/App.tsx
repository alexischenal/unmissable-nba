// src/App.tsx
// The page: header, the night's games (best first), footer.

import { MatchCard } from './components/MatchCard.tsx';
import { useNight } from './hooks/useNight.ts';
import { nightLabel } from './lib/night.ts';

export function App() {
  const state = useNight();
  const night = state.status === 'ready' ? state.night : null;

  let status: string | null = null;
  if (state.status === 'loading') status = 'Loading games…';
  else if (state.status === 'error') status = "Last night's games aren't available yet. Try again in a little while.";
  else if (night?.games.length === 0) status = 'No games last night. Come back tomorrow morning.';

  return (
    <main className="page">
      <header className="page__header">
        <p className="page__brand">Unmissable</p>
        {/* Non-breaking space while loading, so the header doesn't jump */}
        <p className="page__night">{night ? nightLabel(night.date) : ' '}</p>
        <h1 className="page__title">What to watch this morning</h1>
      </header>

      <p className="page__status" role="status" hidden={status === null}>{status}</p>

      <ol className="games" aria-label="Last night's games, most recommended first">
        {night?.games.map((game, i) => (
          <li className="games__item" key={`${game.away}@${game.home}`}>
            <MatchCard game={game} rank={i + 1} featured={i === 0} />
          </li>
        ))}
      </ol>

      <footer className="page__footer">
        Not affiliated with the NBA. Ratings only measure what happened on the court.
      </footer>
    </main>
  );
}
