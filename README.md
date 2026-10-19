# Unmissable

**What to watch this morning.** Last night's NBA games, ranked **without a single spoiler**: you see which game is worth your time, never who won.

Live at [unmissable.am](https://unmissable.am) — *a.m.*, because it's made for the morning after.

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
| `npm run fetch` | **NBA calls**: last night's games → ratings → `public/data/` |
| `npm run fetch -- --date=2026-10-20` | same, for a specific US date |
| `npm run fetch:fixture` | same, with test data, no network |

The site reads `public/data/latest.json`, or a specific night with `?date=2026-04-04`.

## Architecture

```
NBA API (cdn.nba.com)  ←  scripts/fetch-night.ts   (server side, once a day around 8 a.m. Paris time)
                                 ↓  computes the ratings
                         public/data/YYYY-MM-DD.json   (teams + rating, NO score)
                                 ↓
                         index.html + src/main.ts   (reads the JSON, renders the cards)
```

Zero spoilers is guaranteed by the architecture: the score is never published, not even in the JSON.
If one of last night's games isn't over, the script publishes nothing (exit code 2).

```
index.html               page + card template (<template>)
src/styles.css           all the styles
src/main.ts              loads the JSON and renders the cards
src/config/teams.ts      the 30 teams: location, name, colors
src/config/scoring.ts    EVERY setting of the algorithm
src/lib/scoring.ts       the algorithm (pure functions)
src/types/game.ts        the in-house Game type, independent of any API
src/types/public.ts      the public JSON format
scripts/fetch-night.ts   the server script
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

`.github/workflows/daily.yml` runs on GitHub Actions:

- **every morning**, every 30 minutes from 05:00 to 09:30 UTC: fetches last night's games, commits `public/data/*.json`, rebuilds and deploys to GitHub Pages. Once the night is published, the following runs stop right away;
- **on every push to `main`**: rebuilds and deploys (no fetch);
- **manually** (*Actions → Daily update and deploy → Run workflow*), with an optional date.

If a game isn't over, the run keeps the previous data and the next run retries. A postponed game is skipped.

**Pre-launch:** the site carries a `noindex` meta tag and a blocking `robots.txt`. At launch, remove the meta tag in `index.html` and allow crawling in `public/robots.txt`.

## About the NBA data

- These are the public JSON files nba.com itself uses: free, no key, but **undocumented**. The format can change: the adapter checks every field and makes the script fail rather than publish wrong ratings.
- Some NBA servers block requests from cloud hosts: test `npm run fetch` from the host you pick.
- The online schedule only covers the current season: for older games, use the fixtures.
- nba.com's terms of use restrict reuse of its data; the site only publishes its own ratings, never the raw data.
