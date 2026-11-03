// src/components/EmptyNight.tsx
// "No games last night": a whole night went by without games. Instead of yesterday's cards, as if
// nothing had happened, the screen says so and when the games come back (no next night: off-season).

import { EMPTY_NIGHT_GIFS, type Gif } from '../config/gifs.ts';
import { NEXT_URL, nightDates } from '../lib/night.ts';
import type { NightJson } from '../types/public.ts';

// One GIF per visit, picked once (not on every render)
const GIF: Gif | undefined = EMPTY_NIGHT_GIFS[Math.floor(Math.random() * EMPTY_NIGHT_GIFS.length)];

const REDUCED_MOTION = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function GiphyGif({ gif }: { gif: Gif }) {
  const media = `https://media.giphy.com/media/${gif.id}`;
  return (
    <figure className="empty__gif">
      {/* The light video rather than the .gif; a still image when motion is reduced */}
      {REDUCED_MOTION
        ? <img className="empty__media" src={`${media}/giphy_s.gif`} alt={gif.alt} />
        : (
          <video className="empty__media" src={`${media}/giphy.mp4`} poster={`${media}/giphy_s.gif`}
            autoPlay loop muted playsInline aria-label={gif.alt} />
        )}
      <figcaption className="empty__credit">
        <a className="empty__credit-link" href={`https://giphy.com/gifs/${gif.id}`} rel="noopener">via GIPHY</a>
      </figcaption>
    </figure>
  );
}

export function EmptyNight({ next }: { next: NightJson | null }) {
  return (
    <section className="empty" aria-labelledby="empty-title">
      {GIF && <GiphyGif gif={GIF} />}
      <h2 className="empty__title" id="empty-title">No games last night.</h2>
      {next ? (
        <>
          <p className="empty__text">The NBA took the night off.</p>
          <a className="empty__next" href={NEXT_URL}>
            <span className="empty__long">Next night · {nightDates(next.date)}</span>
            <span className="empty__short">Next night · {nightDates(next.date, { short: true })}</span>
          </a>
        </>
      ) : (
        <p className="empty__text">The season is over. See you in October.</p>
      )}
    </section>
  );
}
