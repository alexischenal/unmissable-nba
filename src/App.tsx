// src/App.tsx
// Three pages, same app:
//   - home: the night on screen (best games first), from latest.json;
//   - next (/next): the next calendar night's games, with their tip-off times, from next.json;
//   - about (/how-it-works): where the percentages come from.
// The header says where you are; the other pages are in the burger menu.

import { About } from './components/About.tsx';
import { MatchCard } from './components/MatchCard.tsx';
import { Menu, type MenuItem } from './components/Menu.tsx';
import { useNextNight, useNight } from './hooks/useNight.ts';
import { ABOUT_URL, HOME_URL, NEXT_URL, PAGE, nightDates, nightLabel } from './lib/night.ts';
import { gameState, nightIsComplete, type GameState, type NightJson, type PublicGame } from './types/public.ts';

// Card states are computed once, at page load: no card changes under the visitor's eyes.
const LOADED_AT = Date.now();

if (PAGE === 'about') document.title = 'How it works — Unmissable';

// The three groups, in display order. Rated games come first, without a heading;
// the next groups get an <h2> to separate them.
const GROUPS: { state: GameState; heading: string | null; label: string }[] = [
  { state: 'rated', heading: null, label: 'Finished games, most recommended first' },
  { state: 'live', heading: 'In progress', label: 'Games in progress' },
  { state: 'upcoming', heading: 'Coming up', label: 'Games not started yet' },
];

// The night label, twice: long on wide screens, short on phones (CSS shows one, display: none hides the other,
// so screen readers only read one).
function NightName({ date }: { date: string }) {
  return (
    <>
      <span className="header__long">{nightLabel(date)}</span>
      <span className="header__short">{nightLabel(date, { short: true })}</span>
    </>
  );
}

// "Next night · October 23–24": with its date, since it isn't always tomorrow (days off are skipped)
function NextNightName({ date }: { date: string }) {
  return (
    <>
      <span className="header__long">Next night · {nightDates(date)}</span>
      <span className="header__short">Next night · {nightDates(date, { short: true })}</span>
    </>
  );
}

const ABOUT_ITEM: MenuItem = { key: 'about', href: ABOUT_URL, label: 'How it works' };

export function App() {
  const home = useNight();
  const next = useNextNight();

  const homeNight = home.status === 'ready' ? home.night : null;
  const nextNight = next.status === 'ready' ? next.night : null;
  // The night on screen (none on the About page)
  const night: NightJson | null = PAGE === 'next' ? nextNight : PAGE === 'home' ? homeNight : null;
  const complete = night !== null && nightIsComplete(night);

  // The games split by state, keeping the JSON's order (rated: best first; others: by tip-off)
  const byState = new Map<GameState, { game: PublicGame; index: number }[]>();
  night?.games.forEach((game, index) => {
    const s = gameState(game, LOADED_AT);
    byState.set(s, [...(byState.get(s) ?? []), { game, index }]);
  });

  let status: string | null = null;
  if (PAGE === 'home') {
    if (home.status === 'loading') status = 'Loading games…';
    else if (home.status === 'error') status = "Last night's games aren't available yet. Try again in a little while.";
    else if (homeNight?.games.length === 0) status = 'No games last night. Come back tomorrow morning.';
  } else if (PAGE === 'next') {
    if (next.status === 'loading') status = 'Loading games…';
    else if (next.status === 'error') status = "The next night's games aren't available yet. Try again in a little while.";
    else if (!nextNight) status = 'No games on the next night.';
  }

  // The menu: the other nights first, then How it works
  const menuItems: MenuItem[] = [];
  if (PAGE !== 'home' && homeNight) menuItems.push({ key: 'home', href: HOME_URL, label: <NightName date={homeNight.date} /> });
  if (PAGE !== 'next' && nextNight) menuItems.push({ key: 'next', href: NEXT_URL, label: <NextNightName date={nextNight.date} /> });
  if (PAGE !== 'about') menuItems.push(ABOUT_ITEM);

  // One <h1> per page: the brand on the night pages, the page title on the About page
  const Brand = PAGE === 'about' ? 'p' : 'h1';

  return (
    <>
      <main className="page">
        <header className="header">
          <div className="header__title">
            <Menu items={menuItems} />
            <Brand className="header__brand">
              <a className="header__home" href={HOME_URL}>Unmissable</a>
            </Brand>
          </div>
          {/* Where you are, in plain text. The other pages are in the menu. */}
          <p className="header__night header__current">
            {PAGE === 'about'
              ? 'How it works'
              : PAGE === 'next'
                ? (nextNight ? <NextNightName date={nextNight.date} /> : 'Next night')
                : homeNight ? <NightName date={homeNight.date} /> : ' '}
          </p>
        </header>

        {PAGE === 'about' && <About />}

        <p className="page__status" role="status" hidden={status === null}>{status}</p>

        {GROUPS.map(({ state: groupState, heading, label }) => {
          const games = byState.get(groupState) ?? [];
          if (games.length === 0) return null;
          // On the Next page, no heading: the header already says where you are
          const title = PAGE === 'next' ? null : heading;
          return (
            <section className="games" key={groupState}>
              {title && (
                <h2 className="games__heading">
                  {title}
                  {/* Three dots appearing one after the other: games still going */}
                  {groupState === 'live' && (
                    <svg className="games__dots" aria-hidden="true"><use href="/sprite.svg#dots" /></svg>
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
                      featured={game.note === 100 || (complete && index === 0 && game.note !== undefined)}
                    />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </main>

      {/* On every page, How it works included (marked as the current page there) */}
      <footer className="footer">
        <a className="footer__link" href={ABOUT_URL} aria-current={PAGE === 'about' ? 'page' : undefined}>How it works</a>
      </footer>
    </>
  );
}
