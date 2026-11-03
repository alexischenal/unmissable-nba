// src/components/EmptyNight.tsx
// "No games last night": a whole night went by without games. Instead of yesterday's cards, as if
// nothing had happened, the screen says so and when the games come back (no next night: off-season).
// Laid out like the text pages: left-aligned, same width.

import { EMPTY_NIGHT_GIF as GIF } from '../config/gifs.ts';
import { NEXT_URL, nightDates } from '../lib/night.ts';
import type { NightJson } from '../types/public.ts';

const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function EmptyNight({ next }: { next: NightJson | null }) {
  return (
    <section className="article empty" aria-labelledby="empty-title">
      <h2 className="article__title" id="empty-title">
        Sorry,{' '}
        <span className="empty__subtitle">there's nothing to display anymore…</span>
      </h2>

      <figure className="empty__gif">
        {/* Plays by itself, muted, in a loop; under reduced motion it waits on its first frame */}
        <video
          className="empty__media"
          width={GIF.width}
          height={GIF.height}
          autoPlay={!REDUCED_MOTION}
          controls={REDUCED_MOTION}
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={GIF.alt}
        >
          <source src={GIF.webm} type="video/webm" />
          <source src={GIF.mp4} type="video/mp4" />
        </video>
        <figcaption className="empty__credit">
          <a className="empty__credit-link" href={GIF.page} rel="noopener">via Tenor</a>
        </figcaption>
      </figure>

      {next ? (
        <a className="empty__next" href={NEXT_URL}>
          <span className="empty__long">Next night: {nightDates(next.date)}</span>
          <span className="empty__short">Next night: {nightDates(next.date, { short: true })}</span>
        </a>
      ) : (
        <p className="article__text">The season is over. See you in October.</p>
      )}
    </section>
  );
}
