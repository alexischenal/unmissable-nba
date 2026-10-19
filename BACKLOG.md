# Backlog

## Next up — Monday

1. **Merge the `monday-prep` branch** (the October 17 files: workflow every 30 min from 05:00 UTC, early exit,
   safer postponed-game check, README, `algorithm.txt`, this backlog, plus the `git pull --rebase` fix).
   Done before Wednesday's first real test.
2. **Top priority: move the front end to React** (Vite + React + TypeScript).
   - Why: the planned features (three sections, live updates, cards changing state, menu, "Next night" page)
     add a lot of state to manage — a framework's job. And React is what front-end job offers ask for.
   - What changes: only `index.html` and `src/main.ts`, which become components (`<MatchCard>`, `<GameList>`…).
   - What doesn't: the algorithm, the NBA adapter, the types, the script, the workflow, the JSON format.
     So Wednesday's test isn't at risk.
   - Do it on a separate branch, merge once it renders the April 4 night exactly like today
     (`?date=2026-04-04`).
   - Good moment for the HTML/CSS redesign too (grid, card heights in `svh` with `clamp()`).
3. **Switch the main domain to `unmissable.watch`** ("an unmissable watch": a real English phrase, universal,
   any time of day). The site isn't launched yet: cheapest moment to change.
   - Redo for `.watch` what was done for `.am`: TXT verification (GitHub account → Pages), A + AAAA records
     and the `www` CNAME at OVH, *Custom domain* in the repo's Pages settings, then *Enforce HTTPS*.
     Expect the same GitHub DNS-check delay as on October 17.
   - Then redirect `unmissable.am` → `unmissable.watch` (OVH, permanent redirect). The "a.m." joke stays as a bonus.
   - Replace "unmissable.am" in the README, the header and anywhere else in the code.
4. **Move the styles to SCSS.**
   - Setup is one command: `npm install -D sass-embedded` (or `sass`). Vite compiles `.scss` files by itself:
     no extra config, no separate watcher. `npm run dev` and `npm run build` keep working as they are.
   - Rename `styles.css` → `styles.scss`, then split into partials (`_tokens.scss`, `_card.scss`, `_page.scss`…).
   - Use `@use` / `@forward`, not `@import` (deprecated in Dart Sass, being removed).
   - Keep CSS custom properties for **runtime** values — team colors set from the code (`--primary`,
     `--secondary`) and sizes that change per card (`--card-h`). Use SCSS for structure: nesting, partials,
     mixins (breakpoints, the card halves).

---

Ideas parked for later. Nothing below is needed for v1.

## Empty states (with GIFs)

Rules for every GIF: official GIPHY embed (no self-hosted copy), the light video version
(MP4/WebM) rather than the .gif, alt text, and a still image under `prefers-reduced-motion`.
Pick one at random among several so returning visitors don't always see the same one.

- **No games** — same treatment for **yesterday and tomorrow**: the arrow towards an empty night is disabled,
  and anyone reaching that night anyway sees the no-games screen, with a copy adapted to the direction
  ("No games last night." / "No games tomorrow.") and the same GIF rotation.
- **No games last night** (All-Star break, off days)
  - **Nick Young celebrating a three that misses.** The user opened the site sure there'd be a game… and there isn't.
    Copy idea: *"You were so sure. No games last night."* Favourite: basketball, and original.
  - **John Travolta looking around an empty room** (*Pulp Fiction*). Literally the emptiness.
  - **Crying Jordan.** The sports despair classic (a bit overused).
  - Other options: Michael Scott "No, God! No, God, please, no!" (*The Office*), "This is fine" dog,
    Squidward at his window (*SpongeBob*).
- **Error state** (data couldn't be loaded)
  - **Tim Robinson in the hot dog costume: "We're all trying to find the guy who did this."**
    (*I Think You Should Leave*). The site is the obvious culprit pretending to look for one — exactly the meme.
    Copy idea: *"Something broke. We're all trying to find the guy who did this."*

## Product

- **Rule: every time on the site is relative, never a clock time.** "Last update 12 min ago",
  "Next check in 8 min", "Tip-off in 6 h 30 min". No time zone to handle or display, it reads the same
  for everyone. `Intl.RelativeTimeFormat` for past times.
  Only the countdowns (next check, tip-off) are recalculated every minute; "Last update X min ago" is computed
  once at page load — people know to hit F5.
  (Relies on the visitor's device clock being right — fine in practice.)

- **Featured cards: every game at 100, not just the first one.**
  - Every game rated 100 gets the taller, featured card.
  - If no game reaches 100, the best-rated game gets it (current behaviour).
  - So a night with several games at 100 shows several featured cards.
  - Implementation hint (`src/main.ts`, `renderCard`): `card--featured` when `game.note === 100 || index === 0`.
- **Header layout** (one row):
  - **Far left**: the burger menu, before the name (on desktop too).
  - **Left**: "unmissable.am", link to the home page (= the current night).
  - **Centre**: "Last update X min ago", with the night label ("Night of October 20–21") just under it.
  - **Right**: the two navigation arrows (back / forward one night).
  - **As the screen narrows, items move into the burger** (the "priority+" pattern): on mobile, none of it fits.
    On mobile, keep only **the burger, the name and the two navigation arrows**; "Last update" and the
    night label go into the burger.
  - **Navigating from night to night updates the header**: the night label and "Last update" always describe
    the night on screen (each night's JSON carries its own date and `updatedAt`).
    On mobile, keep a **short label always visible, right under the two arrows** ("Yesterday" / "Tonight" /
    "Tomorrow"): it sits next to the control that changes it, so tapping an arrow and seeing the label
    change go together. With the full night label in the burger, nothing else would say which night you're on.
  - Implementation: simplest and most robust is to have each item in both places (header and menu) and
    show one or the other with media queries (or container queries on the header). No JavaScript moving
    elements around. Hidden copies use `display: none`, so screen readers don't read them twice.
- **Last update**: when the data was last updated, as relative time: *"Last update 30 minutes ago"*.
  - Script: add an `updatedAt` field (ISO date, UTC) to the public JSON. Only change it when the games
    themselves change, otherwise every run would rewrite the file and create a commit for nothing.
    Doesn't spoil anything: it only says when the ratings were computed.
  - Front: `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` gives "30 minutes ago", "1 hour ago", "yesterday"
    for free, computed once at page load (no live refresh needed). Use a `<time datetime="…">` element.
  - Bonus: if the data is more than ~30 hours old, say so ("No update since yesterday") instead of
    silently showing an old night.
- **Menu (burger) in the mini header**, for what doesn't need to be on screen all the time:
  - **Update info**: "Last update 12 min ago · Next check in ~8 min".
    The next check can be computed in the front from the workflow schedule (every 15 or 30 min within the window).
    With GitHub's schedule alone, show it as approximate ("~", "around"): runs can start several minutes late.
    With cron-job.org in front, checks start on the minute, so the countdown becomes reliable
    (run + deploy still adds 1–2 minutes). Outside the window too: "Next check in 3 h 12 min".
    Say "check", not "update": a check only updates the site if a game has finished since the last one.
    The schedule then lives in three places (front, workflow, cron-job.org): keep the front's copy in one
    shared constant, and update all three together.
  - **How the rating works** (the text in `how-it-works.txt`).
  - **About**: not affiliated with the NBA, no cookies, link to the GitHub repo.

- **Tags per game** (tap a card to reveal them). Only on-court facts, never prestige ("top clash", rivalry…).
  Rate each tag's spoiler risk; a spoiler tag needs an explicit second action.
- **Reveal the score on tap**, as a deliberate action (never on hover or scroll).
- **Other sports**: the home page becomes "best game of the night, all sports", sports move to `/basketball`, `/football`…
- **Dark mode.**

## Updates during the day — rate each game as soon as it ends

Goal: games that end in the European evening (US weekend afternoons, Christmas Day, NBA Cup,
games played in Europe…) should be rated right away, not the next morning.
"As soon as it ends, you know whether it's worth watching."

- **Run often, from 9 p.m. Paris time to the next morning.** v1: every 30 minutes from 05:00 to 09:30 UTC.
  Move to every 15 minutes, from the evening until late morning, with a cheap early exit when there's nothing new.
  GitHub cron is UTC only, so to cover 9 p.m. Paris all season (UTC+1 in winter, UTC+2 in spring/fall):
  `*/15 19-23,0-9 * * *` → from 19:00 UTC (8 p.m. Paris in winter, 9 p.m. in summer) to 09:45 UTC.
  The first evening games (a 7 p.m. Paris tip-off) end around 9:15 p.m.
  - Check statuses with the light scoreboard file
    (`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`) rather than the full schedule.
  - Only fetch the box score of games that became final since the last run.
  - Only change `updatedAt` / commit when a game was added or changed.
  - GitHub scheduled runs can start a few minutes late: "as soon as it ends" means within ~15–30 min.
- **Precise timing with cron-job.org in front of GitHub.** GitHub scheduled runs can start several
  minutes late. A free external cron service (cron-job.org) can call the GitHub API on the minute to start
  the workflow (`workflow_dispatch`, same as the *Run workflow* button):
  `POST https://api.github.com/repos/alexischenal/unmissable-nba/actions/workflows/daily.yml/dispatches`
  with body `{"ref":"main"}` and headers `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`.
  - **Keep the GitHub schedule as a fallback** — it's exactly today's setup. When cron-job.org works, the
    following scheduled runs stop right away (nothing new); if it fails, GitHub takes over, just less punctually.
    Duplicates are harmless: the `pages` concurrency group never deploys twice at once, and the script
    exits early when the night is already up to date.
  - **Token**: a fine-grained personal access token limited to this one repository, with only
    "Actions: read and write". Worst case if stolen: someone can trigger the workflow, nothing more.
  - **Expiration**: set one (e.g. 1 year), write the date in a calendar, and turn on cron-job.org's
    failure e-mails — an expired token fails silently otherwise.
  - Precision gained: the run starts on time; running + deploying still takes 1–2 minutes.
- **Publish progressively**: rate finished games as they end; the night's ranking fills in over time.
  This replaces today's rule ("a complete night or nothing"). The JSON per US date keeps growing until
  every game is final.
- **Greyed-out card for games in progress**: same layout, team colors desaturated, no rating,
  a neutral label ("Still playing"). Never a live score, never a hint of the result.
  - New JSON field per game, e.g. `"status": "final" | "live" | "scheduled"`. Only `final` games carry a `note`.
  - Live games go below rated ones (or in their own "Still playing" section).
- **Rule: the previous night stays on screen until the first game of the new night tips off.**
  Someone opening the site at 7:30 p.m. (European evening, looking for a replay to watch tonight) sees
  last night's full ranking. At the first tip-off, the page switches to the new night and shows **all** its
  games, each card going through three states during the night:
  1. **Not started**: the local tip-off time in the middle ("01:30 · Paris time"), in an outlined box
     (never read as a rating).
  2. **Still playing**: greyed card, nothing in the middle.
  3. **Final**: team colors and the rating.
  - No more near-empty page: the whole slate is visible from the first tip-off, ratings arrive one by one.
  - Script: switch `latest.json` to the new night as soon as one of its games is live, with each game's
    status and tip-off time (UTC, ISO). Only `final` games carry a rating.
- **Page layout during a night in progress — four sections:**
  1. **Finished games**, ranked (the current list).
  2. **"Just finished"**, only when needed: games that got rated *while the page was open*.
     They land here instead of being inserted into the ranking, so nothing jumps around under the
     visitor's eyes. On the next reload, they simply join the ranking above.
  3. **"Still playing"**, the greyed cards.
  4. **"Coming up"**, games not started yet, by tip-off time, with their local time in the middle.
  - "Just finished" fills up with every game that ends while the page is open, **in order of arrival,
    each new one added at the end of the section** (right above "Still playing", where the eye already is).
    Sorting it by rating would reshuffle cards under the visitor's eyes; on reload they all join the ranking anyway.
  - **Same featured rules in "Just finished"**: a game at 100 gets the featured card; so does a game that
    becomes the best of the night. Apply the normal rules right away (the former best shrinks back):
    the shift isn't dramatic, and most of the time nobody is looking at the tab when it happens.
  - **Wanted: tab notifications.** Signal new ratings in the tab title, e.g. "(2) Unmissable": you see it
    from another tab, it says "something new", it doesn't say what. Reset to "Unmissable" when the tab is
    viewed again. No dot on the favicon: the title is enough.
  - **Undecided:**
    - Pausing the JSON re-reads when the tab is hidden and re-reading as soon as the visitor comes back
      (`visibilitychange`). Browsers throttle timers in background tabs anyway.
    - Any appearance effect for the rating or the card (pop-in), and when to play it.
  - "Just finished" is purely client-side ("since you opened the page"): someone arriving later sees the
    game directly in the ranking. Requires the page to re-read the JSON regularly (e.g. every minute).
- **A game still playing has no rating box: nothing in the middle.** The two greyed halves just meet at
  the diagonal; the missing box *is* the message ("not rated yet"). **No animation** on these cards:
  with up to ~10 cards on a page made only of cards, anything pulsing or breathing becomes noise.
  Keep an accessible text for screen readers ("Still playing").
  - Only possible exception, to decide later: a single, short, one-time pop-in of the rating box at the
    moment a game gets rated, if the page is open. Nothing that loops.
- **A game still playing is a teaser, not a spoiler.** If two games tip off together and one is still
  going while the other is already rated, the visitor guesses it's tight — and that's the point: it makes
  them want to refresh until the final rating. The rating already tells "this one was close"; what must
  never leak is the score and the winner. No need to hide start times or how long a game has been live.

## Edge cases

- **Postponed games — priority: medium.** Remove them **as soon as they're postponed**: never shown in
  "Coming up" or "Still playing". The NBA marks them in the schedule / scoreboard (status text like "PPD" /
  "Postponed"): to confirm on a real case. In v1 they're already skipped, but only once the night is surely over.
- **All-Star break — dedicated screen.** Nobody cares about the games that weekend (All-Star Game, Rising Stars…):
  nothing ranked, a specific screen instead of the usual no-games one. Dates to define later (they change every season).
- **New team (expansion)**: a team missing from `src/config/teams.ts` shows in default grey. Nothing breaks;
  add its colors when it happens.
- **Off-season (June → October) — priority: very low.** A dedicated screen ("Season's over. See you in October.")
  instead of showing the Finals forever. The season hasn't even started: later, much later.

## Manual maintenance — once a season

Things that need a human, to check every summer before the new season:

- **All-Star break dates** — set them for the season's screen.
  Possible help: the All-Star Game is in the schedule (gameId prefix `003`), so the script could at least
  log or suggest the dates.
- **Teams**: new franchise (expansion), relocation, rebrand or new colors (like Utah in 2025) → update
  `src/config/teams.ts`. A new team makes enough noise in the news: no automatic alert needed.
- **cron-job.org token** (once it's set up): renew before it expires.
- **Domains**: renewals are automatic at OVH, just check the payment method is still valid.
- **Domain `unmissable.watch`** (bought October 17, 2026 for €4; renewal ~€40/year): the main domain from now on.
- **Domain `unmissable.am`** stays as a redirect to `.watch` (renewal €38/year): at renewal time, decide whether
  the joke is worth keeping.
- **Scheduled workflow**: on a public repo, GitHub disables scheduled workflows after 60 days without
  activity. No games all summer = no commits = the cron gets switched off. Before the season starts:
  *Actions → Daily update and deploy → Enable workflow* if GitHub disabled it.
- **NBA data**: quick test run at the start of the season — the schedule file switches to the new season.

## Algorithm v2 — play-by-play data

Today the script only fetches each game's box score: quarter scores, player stats, and the
**totals** of lead changes and ties, with no idea **when** they happened. Known flaw: early lead
changes count as much as late ones (e.g. Pistons @ 76ers, April 4, 2026: 3 "scenario" points from
first-quarter lead changes, in a 23-point blowout).

The NBA publishes a play-by-play file per game on the same CDN as the box scores:
`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_<gameId>.json`
(every basket, foul and rebound, with the clock and the score at that moment).
Cost: one extra call per game (~15 per night). Format undocumented: check it on a real game first.
For older games (fixtures), Basketball-Reference publishes play-by-play pages too.

What it would enable:
- **Scenario**: only count lead changes and ties in the second half, or in the last minutes.
- **Clutch**: the NBA definition — margin ≤ 5 in the last 5 minutes. Probably a better suspense
  measure than the final margin.
- **Runs**: detect a 15-0 run that flips a game, and date a comeback precisely.

To do after the box score is validated (October 21) and the current algorithm is calibrated on a few nights.

## Quality

- Unit tests for `src/lib/scoring.ts` (the April 4, 2026 fixtures are ready-made test cases).
- Calibrate the algorithm on real nights: the scenario threshold (20) and the efficiency threshold (30).
- **Measure the efficiency distribution with our own data.** No reliable public game-by-game EFF numbers were found.
  Have `fetch-night.ts` log, for each game, the highest efficiencies (and how many players are above 30 / 40 / 50)
  in the GitHub Action log only — never published. After 2–3 weeks, set the thresholds on real numbers.
  Rough estimates from 2025-26 season averages (not official): Jokić ~40–45 EFF per game, Wembanyama ~33–35,
  a regular starter 10–20. Watch out: Jokić clears 30 almost every night (an average Jokić game ≈ 8.5 performance points).
- **Keep the meaning of 50.** Anything at 50 or above must be at least a decent game to watch
  (it passed the "competitive" test); below 50 = you can skip it. When calibrating, if a game rated 50+
  turns out dull, tighten the competitive conditions (`disputed` in `src/config/scoring.ts`: regulation
  margin ≤ 10, Q3 margin ≤ 5, loser's biggest lead ≥ 12) rather than tweaking the points.
  No labels on top of the number: the rating alone is the information.
- **Track how many games are shown at 100 per week.** A 100 should stay rare and earned.
  Keep the 80 ceiling for a game without big performances (50 + 30): it gives the 100 its meaning
  — a 100 always involves at least one exceptional individual night.
  If there are more than 1–2 per week, don't touch the 80: raise the performance divisor in
  `src/config/scoring.ts` (20 today). At 25: EFF 50 → 16 points instead of 20, EFF 60 → 36 instead of 45.
- Neutral favicon and social preview image (nothing about results).
- **Visit counter — the simplest and least invasive possible: GoatCounter.**
  - One `<script>` line in `index.html`, free for non-commercial use, open source, no cookies, no personal data
    stored, no cross-site tracking. Gives the essentials only: visits per day, pages, referrers, screen sizes.
  - No consent banner expected for this kind of tool (to double-check against the CNIL's conditions).
  - Even lighter option: GoatCounter can count with a tiny image instead of JavaScript.
  - Alternatives considered: Cloudflare Web Analytics (needs a Cloudflare account), Umami (more to set up).

## Much later — "Next night" page

Not before the progressive updates are in place. The site could also become the place to check
what's on tonight, in your own time. Partly covered by the main page from the first tip-off ("Coming up"
cards); this separate page is for checking tonight's slate earlier in the day, before any game has started.
Same card design as the "Coming up" state.

Why it's needed: French sites split one US night across two dates. Example, opening night 2026
(US date October 20, three games): basketusa.com lists the first game on 20/10 and the other two on 21/10,
because of their Paris tip-off times. Same night, two days. Unmissable groups by US night
("Night of October 20–21") and shows every tip-off in local time inside that one night.

- **The upcoming games, with tip-off times in the visitor's own time zone**, followed by the time zone
  name, e.g. "01:30 AM Paris time · in 6 h 30 min" (no "7 p.m. ET" to convert: real added value for a European).
- **Local time**: the browser already knows its time zone (from the device settings). The script publishes
  each tip-off in UTC (ISO), and `new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })`
  shows it in local time. No geolocation, no permission prompt, nothing to configure.
  Only exception to the "relative times only" rule: clock times are fine here, because the browser converts them.
- **Time zone name**: take the city from the browser's IANA zone,
  `Intl.DateTimeFormat().resolvedOptions().timeZone` ("Europe/Paris" → "Paris time",
  "America/New_York" → "New York time"). Clear and consistent everywhere. It's always the visitor's own
  zone: a Pole sees "Warsaw time", someone in Lyon "Paris time" (the zone's reference city).
  - Fallback when the zone has no city ("UTC", "Etc/GMT-2"): `timeZoneName: 'longGeneric'` ("GMT", "GMT+02:00").
  - Tested alternatives: `timeZoneName: 'short'` gives "GMT+2" for Paris but "EDT" for New York;
    `'shortGeneric'` mixes "France Time" and "ET"; `'longGeneric'` gives "Central European Time", correct but long.
- **Neutral on purpose**: no prediction, no "big game" label, no team ranking — same philosophy as the
  ratings (only what happens on the court counts, and it hasn't happened yet).
- **Data**: already there — the script downloads the season schedule every run. Publish the next night's
  matchups and tip-off times in a small separate JSON.
- **Design: same look as the main page** — same cards, team colors, watermark abbreviations. The middle box
  shows the local tip-off time ("01:30") instead of a rating, with "Paris time · in 6 h 30 min" as a small line.
  Do both, so a time is never read as a rating: an outlined box instead of a filled one, and a clear page
  title ("Tonight" vs "Last night").
- **Navigation: three nights, no more — a back arrow and a forward arrow side by side in the header.**
  Unmissable is not an archive site: you can go one night back and one night forward, that's it.
  - Strictly the **calendar nights next to the one on screen**: the arrows only ever move one night back or
    one night forward. Both targets update at the first tip-off, together with the main page.
  - **If the adjacent night has no games, its arrow is disabled** (greyed, not clickable), in both directions.
    E.g. during the All-Star break, no forward arrow at all — we don't jump to the next night with games.
    Someone reaching an empty night anyway (old link, typed URL) gets the no-games screen.
  - Labels (relative to now, everyday words): **"Yesterday" / "Tonight" / "Tomorrow"** — symmetric, and a
    little wink to an audience that watches games at 3 a.m. and for whom time stopped meaning much anyway.
    Since the arrows never skip a night, "Yesterday" and "Tomorrow" are always true.
  - On the "Last night" page, the back button is disabled (no further back); on the "Next night" page, the
    forward button is disabled. Each page has a way back to the main page.
  - Technically easy: every night is already saved as its own JSON (`public/data/YYYY-MM-DD.json`, empty
    nights included) and the page already reads `?date=YYYY-MM-DD`. "Last night" = the calendar night
    before; the page reads its JSON and disables the button if `games` is empty.
  - A toggle between "current" and "next" was considered and dropped: harder to fit in the header.

## Launch

- Remove the `noindex` meta in `index.html` and allow crawling in `public/robots.txt`.
- README for the portfolio: screenshot, the zero-spoiler architecture, the adapter, the two-step algorithm,
  and how it differs from Thuuz (2014 app that rated game excitement live; Unmissable is for the morning after).
