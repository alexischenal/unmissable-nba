# Unmissable

**What to watch this morning.** Last night's NBA games, ranked **without a single spoiler**: you see which game is worth your time, never who won.

Live at [unmissable.watch](https://unmissable.watch).

> Not affiliated with the NBA. No official logos or typefaces: team colors and abbreviations only.

## Getting started

Requirements: Node 22.6 or later.

```bash
npm install
npm run fetch:fixture   # generates public/data/latest.json from the real games of April 4, 2026
npm run dev             # http://localhost:5173
```

In WebStorm: *Open* the folder; the scripts show up in the **npm** tool window.

| Script | What it does |
|---|---|
| `npm run dev` | local site |
| `npm run build` | static site in `dist/` |
| `npm run typecheck` | TypeScript check |
| `npm run fetch` | **NBA calls**: the night to publish, if any → ratings → `public/data/` |
| `npm test` | tests of the run rules |
| `npm run fetch -- --date=2026-10-20` | same, for a specific US date |
| `npm run fetch:fixture` | same, with test data, no network |

The site reads `public/data/latest.json`, or a specific night with `?date=2026-04-04`.

## Architecture

```
NBA API (cdn.nba.com)  ←  scripts/fetch-night.ts   (server side, every 15 minutes)
                                 ↓  computes the ratings
                         public/data/YYYY-MM-DD.json   (teams + rating, NO score)
                                 ↓
                         React app (src/)   (reads the JSON, renders the cards)
```

Zero spoilers is guaranteed by the architecture: the score is never published, not even in the JSON.
If one of last night's games isn't over, the script publishes nothing (exit code 2).

```
index.html               page shell (React mounts in #root)
src/main.tsx             entry point
src/App.tsx              the page: header, list of games, footer
src/components/          MatchCard (one game)
src/hooks/useNight.ts    loads the night: loading / ready / error
src/lib/night.ts         fetching the JSON, "Night of…" label (no React)
src/styles.scss          all the styles (Sass, compiled by Vite)
src/config/teams.ts      the 30 teams: location, name, colors
src/config/scoring.ts    EVERY setting of the algorithm
src/lib/scoring.ts       the algorithm (pure functions)
src/types/game.ts        the in-house Game type, independent of any API
src/types/public.ts      the public JSON format
scripts/fetch-night.ts   the server script
scripts/nba/plan.ts      what a run should do (pure function, tested in plan.test.ts)
scripts/nba/client.ts    HTTP calls to nba.com
scripts/nba/adapter.ts   NBA format → Game type (the only file to fix if the NBA changes its format)
scripts/nba/types.ts     shape of the NBA responses
fixtures/                real games of April 4, 2026, to develop without network
```

## The algorithm

The rating only measures what happened on the court, never who was playing.

1. **Competitive or blowout?** Competitive if the margin is ≤ 10 at the end of regulation, or ≤ 5 at the end of the 3rd quarter, or if the losing team led by 12 or more.
2. **Competitive**: 50 points, plus up to 30 points of competitiveness and entertainment (suspense, scenario, comeback, points scored per 48 min), plus performances: every player above 30 efficiency adds `(eff − 30)² / 20`, uncapped.
3. **Blowout**: same calculation, capped at 49. A blowout stays a blowout.

Games are ranked on the raw rating (which can exceed 100); the display is capped at 100.

Full formulas and worked examples on real games: [`algorithm.txt`](algorithm.txt).

## Deployment

`.github/workflows/update.yml` runs on GitHub Actions:

- **every 15 minutes**: `scripts/nba/plan.ts` decides whether there's anything to do. Before the last tip-off of a
  night, nothing (the run stops in seconds, nothing is deployed). After it, the box scores are checked; as soon as
  every game is over, the night is published: `public/data/*.json` committed, site rebuilt and deployed.
  A night that's still unpublished the next day gets caught up. A day without games publishes nothing: the site
  keeps showing the last night;
- **on every push to `main`**: rebuilds and deploys (no fetch);
- **manually** (*Actions → Update and deploy → Run workflow*), with an optional date.

If a game isn't over, nothing is published and the next run retries. A postponed game is skipped once the night is
surely over. `npm test` checks these rules on opening night's real tip-off times.

**Pre-launch:** the site carries a `noindex` meta tag and a blocking `robots.txt`. At launch, remove the meta tag in `index.html` and allow crawling in `public/robots.txt`.

## About the NBA data

- These are the public JSON files nba.com itself uses: free, no key, but **undocumented**. The format can change: the adapter checks every field and makes the script fail rather than publish wrong ratings.
- Some NBA servers block requests from cloud hosts: test `npm run fetch` from the host you pick.
- The online schedule only covers the current season: for older games, use the fixtures.
- nba.com's terms of use restrict reuse of its data; the site only publishes its own ratings, never the raw data.
