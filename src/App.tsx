// src/App.tsx
// The page: header, the night's games (best first), footer.

import { MatchCard } from './components/MatchCard.tsx';
import { useNight } from './hooks/useNight.ts';
import { nightLabel } from './lib/night.ts';
import { gameState, nightIsComplete, type GameState, type PublicGame } from './types/public.ts';

// Card states are computed once, at page load: no card changes under the visitor's eyes.
const LOADED_AT = Date.now();

// The three groups, in display order. Rated games come first, without a heading;
// the next groups get an <h2> to separate them.
const GROUPS: { state: GameState; heading: string | null; label: string }[] = [
  { state: 'rated', heading: null, label: 'Finished games, most recommended first' },
  { state: 'live', heading: 'In progress', label: 'Games in progress' },
  { state: 'upcoming', heading: 'Coming up', label: 'Games not started yet' },
];

export function App() {
  const state = useNight();
  const night = state.status === 'ready' ? state.night : null;
  const complete = night !== null && nightIsComplete(night);

  // The games split by state, keeping the JSON's order (rated: best first; others: by tip-off)
  const byState = new Map<GameState, { game: PublicGame; index: number }[]>();
  night?.games.forEach((game, index) => {
    const s = gameState(game, LOADED_AT);
    byState.set(s, [...(byState.get(s) ?? []), { game, index }]);
  });

  let status: string | null = null;
  if (state.status === 'loading') status = 'Loading games…';
  else if (state.status === 'error') status = "Last night's games aren't available yet. Try again in a little while.";
  else if (night?.games.length === 0) status = 'No games last night. Come back tomorrow morning.';

  return (
    <main className="page">
      <header className="header">
        <div className="header__title">
          <h1 className="header__brand">Unmissable</h1>
        </div>
        <p className="header__night">{night ? nightLabel(night.date) : '\u00A0'}</p>
      </header>

      <p className="page__status" role="status" hidden={status === null}>{status}</p>

      {GROUPS.map(({ state: groupState, heading, label }) => {
        const games = byState.get(groupState) ?? [];
        if (games.length === 0) return null;
        return (
          <section className="games" key={groupState}>
            {heading && (
              <h2 className="games__heading">
                {heading}
                {/* Three dots appearing one after the other: games still going */}
                {groupState === 'live' && (
                  <span className="games__dots" aria-hidden="true">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                )}
              </h2>
            )}
            <ol className="games__list" aria-label={label}>
              {games.map(({ game, index }) => (
                <li className="games__item" key={`${game.away}@${game.home}`}>
                  <MatchCard
                    game={game}
                    state={groupState}
                    rank={index + 1}
                    // A 100 is featured right away; otherwise the best game, once the whole night is rated.
                    featured={game.note === 100 || (complete && index === 0)}
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <footer className="page__footer">
        Not affiliated with the NBA. Ratings only measure what happened on the court.
      </footer>
    </main>
  );
}
