// src/components/About.tsx
// The "How it works" page: where the percentages come from. Ingredients only, never the settings.

// The card's flame, at text size: read as "flame" by screen readers, unless the word is already next to it
function Flame({ decorative = false }: { decorative?: boolean }) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'flame' };
  return (
    <span className="article__flame" {...a11y}>
      <svg className="article__flame-icon" aria-hidden="true"><use href="/sprite.svg#flame" /></svg>
    </span>
  );
}

// The hidden level's button, at text size, crackling. Only shown next to its name: hidden from screen readers.
function SpicyRock() {
  return (
    <span className="article__flame article__flame--nuclear" aria-hidden="true">
      <span className="article__sparks" aria-hidden="true" />
      <svg className="article__flame-icon" aria-hidden="true"><use href="/sprite.svg#nuclear" /></svg>
    </span>
  );
}

export function About() {
  return (
    <article className="article">
      <h1 className="article__title">Another percentage, on my NBA?</h1>

      <p className="article__text">
        Where do these percentages come from? As soon as a game ends, Unmissable.watch politely asks the NBA
        for every stat and every play of the game (sometimes published with a delay). Then the algorithm gets
        to work.
      </p>

      <h2 className="article__subtitle">Step one: blowout or close game?</h2>
      <p className="article__text">
        Blowouts start at 0% and never go above 49%, whatever happens. Big performances get{' '}
        {/* "a", the flame and "instead!" stay on the same line */}
        <span className="article__nowrap">
          a <Flame /> instead!
        </span>
        <br />
        Close games start at 50%.
      </p>

      <h2 className="article__subtitle">Step two: the story of the game</h2>
      <p className="article__text">
        A huge comeback? Five minutes of crazy clutch time? Lead changes all game long? A shootout? Each one
        adds points.
      </p>

      <h2 className="article__subtitle">And then, step three: individual performances</h2>
      <p className="article__text">
        A good night barely counts. A huge one sends the rating flying.
        <br />
        Long story short: monster performances in close games are unmissable. Check here before picking a
        replay.
      </p>

      <h2 className="article__subtitle">
        Good to know – the flame <Flame decorative />
      </h2>
      <p className="article__text">
        A flame next to a percentage means somebody cooked. Tap it to see the performances: big, huge or crazy.
        Best case: several! No spoilers.
      </p>

      <h2 className="article__subtitle">
        Good to know – the spicy rock <SpicyRock />
      </h2>
      <p className="article__text">Bro, WTF! Just watch it!</p>

      <h2 className="article__subtitle">Good to know – the math</h2>
      <p className="article__text">
        The math has no ceiling: a crazy night keeps adding points, because nobody should put a limit on
        what players can do. The display stops at 100%, which simply means unmissable.
      </p>
      <p className="article__text article__promise">You'll know what to watch. You'll never know who won.</p>

      <p className="article__text">To show what it looks like, here's every game of last season, rated.</p>
      <figure className="article__figure">
        <img
          className="article__image"
          src="/img/season-2025-26.webp"
          srcSet="/img/season-2025-26.webp 800w, /img/season-2025-26@2x.webp 1600w"
          sizes="(max-width: 840px) 100vw, 800px"
          width="800"
          height="460"
          loading="lazy"
          alt="Every game of the 2025–26 season as a dot, stacked on its rating: 46% of the 1,230 games are under 50%, 54% at 50% or more, and 15 reach 100%."
        />
      </figure>
    </article>
  );
}
