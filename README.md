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
The JSON only holds the teams, the tip-off time and, once a game is over, its rating.

```
index.html               page shell (React mounts in #root)
src/main.tsx             entry point
src/App.tsx              the page: header, list of games, footer
src/components/          MatchCard (one game)
src/hooks/useNight.ts    loads the night: loading / ready / error
src/lib/night.ts         fetching the JSON, "Night of…" label (no React)
src/scss/main.scss       styles entry point: @use the partials (_page, _header, _card), compiled by Vite
src/config/teams.ts      the 30 teams: location, name, colors
src/config/scoring.ts    EVERY setting of the algorithm
src/lib/scoring.ts       the algorithm (pure functions)
src/types/game.ts        the in-house Game type, independent of any API
src/types/public.ts      the public JSON format
scripts/fetch-night.ts   the server script
scripts/nba/plan.ts      what a run should do (pure function, tested in plan.test.ts)
scripts/nba/order.ts     the order of the games in the JSON (tested in order.test.ts)
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

Games are ranked on the raw rating (which can exceed 100); the display is capped at 100. The raw rating is in the public JSON (`raw`), never shown on the site: it says nothing about the winner, and whoever digs into the JSON is welcome to it.

Full formulas and worked examples on real games: [`algorithm.txt`](algorithm.txt).

## Deployment

`.github/workflows/update.yml` runs on GitHub Actions:

- **every 15 minutes**: `scripts/nba/plan.ts` decides whether there's anything to do. Until a night's first
  tip-off, the site keeps showing the previous night. At the first tip-off, the night appears with every game
  unrated; then each game gets its rating as soon as it's over. A run only commits and redeploys when something
  changed. A night still incomplete the next day gets caught up. A day without games publishes nothing;
- **on every push to `main`**: rebuilds and deploys (no fetch);
- **manually** (*Actions → Update and deploy → Run workflow*), with an optional date.

A game is never rated before it's over (no partial rating). A postponed game is skipped once the night is surely
over. `npm test` checks these rules on opening night's real tip-off times.

On the site, a card has three states, computed at page load: **upcoming** (the tip-off time, in the visitor's own
time zone and format), **live** (no block in the middle, under an "In progress" heading), **rated**. Rated games come first, best first.
A 100 is featured right away; otherwise the best game is featured once the whole night is rated.

**Pre-launch:** the site carries a `noindex` meta tag and a blocking `robots.txt`. At launch, remove the meta tag in `index.html` and allow crawling in `public/robots.txt`.

## About the NBA data

- These are the public JSON files nba.com itself uses: free, no key, but **undocumented**. The format can change: the adapter checks every field and makes the script fail rather than publish wrong ratings.
- Some NBA servers block requests from cloud hosts: test `npm run fetch` from the host you pick.
- The online schedule only covers the current season: for older games, use the fixtures.
- nba.com's terms of use restrict reuse of its data; the site only publishes its own ratings, never the raw data.
