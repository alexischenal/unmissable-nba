// src/components/About.tsx
// The "How it works" page: where the percentages come from. Ingredients only, never the settings.

export function About() {
  return (
    <article className="about">
      <h1 className="about__title">Percentages on my NBA?</h1>

      <p className="about__text">
        Where do these percentages come from? As soon as a game ends, Unmissable.watch politely asks the NBA
        for its box score and play-by-play. Then the algorithm gets to work.
      </p>

      <h2 className="about__subtitle">Step one: blowout or real game?</h2>
      <p className="about__text">
        Blowouts start at 0% and can never go above 49%. Scoring 80 in a blowout is still a blowout, so it
        stays there.
      </p>
      <p className="about__text">Competitive games start at 50%.</p>

      <h2 className="about__subtitle">Step two: the story of the game</h2>
      <p className="about__text">
        A huge comeback? Five minutes of crazy clutch time? Lead changes all night long? Each one adds points.
      </p>

      <h2 className="about__subtitle">And then, the pièce de résistance: individual performances</h2>
      <p className="about__text">A good night barely counts. A huge one sends the rating flying.</p>
      <p className="about__text">
        In short: a monster performance in a real game is unmissable, and you won't miss it if you check here
        before picking a replay.
      </p>
      <p className="about__text about__promise">You'll know what to watch. You'll never know who won.</p>

      <p className="about__text">To show what it looks like, here's every game of last season, rated.</p>
      <figure className="about__figure">
        <img
          className="about__image"
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
