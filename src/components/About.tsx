// src/components/About.tsx
// The "How it works" page: where the percentages come from. Ingredients only, never the settings.

export function About() {
  return (
    <article className="article">
      <h1 className="article__title">Another percentage, on my NBA?</h1>

      <p className="article__text">
        Where do these percentages come from? As soon as a game ends, Unmissable.watch politely asks the NBA
        for its box score and play-by-play. Then the algorithm gets to work.
      </p>

      <h2 className="article__subtitle">Step one: blowout or close game?</h2>
      <p className="article__text">
        Blowouts start at 0% and can never go above 49%. Scoring 80 in a blowout is still a blowout, so it
        stays there.
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
        Long story short: monster performances in close games are unmissable. You won't miss those if you check
        here before picking a replay.
      </p>

      <h2 className="article__subtitle">Good to know</h2>
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
