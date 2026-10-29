# Backlog

## Under consideration — the rating scale

Not decided. Possible changes, and what each one does.

- **Give games close only until the end of Q3 the same base as the other close games** (the Q3 rule then
  does nothing: drop it). One setting, no code.
  - Every game under 50 is then a blowout.
  - 45–49 only holds blowouts lifted by one player's historic night: a blowout gets almost no spectacle
    points, so only a huge performance takes it that high.
  - Those Q3 games, decided in the fourth, move into the 50s: the top half no longer only holds games
    worth watching to the end.
  - A lower base than the other close games isn't enough: a Q3 game with little spectacle stays in 45–49.
- **Recommend games from 60 up** (explanation page only, no change to the rating).
  - With the change above, Q3 games mostly stay under the recommendation.
  - Without it, nothing changes in the rating; only the advice does.
  - 50 reads by itself ("the good half"), 60 needs the explanation page.
- **To measure before deciding:** run `season-stats` with the new base and compare the CSV with the current
  one (games leaving 45–49, games left in it, games passing 60). Published ratings stay as they are;
  going back is the same one-setting change.

### Checked and dropped: the comeback "back within one possession", whoever won (October 25)

- **The worry**: the comeback counts the loser's biggest lead, so only comebacks that went all the way. A
  high rating and a big early lead would then tell who wins.
- **The idea**: count the biggest deficit a team came back from to within one possession (3 points), whoever
  won, in the rating and in the step 1 test.
- **Measured on 2025-26** (local simulation, removed since): in games where a team led big, the share where
  that team lost.
  - Today: about 1 in 2 from 70 up (53%, 45% from 85 up, small samples). A coin flip: the rating says
    something will happen, not who wins. No real leak.
  - With the idea: about 30%. The viewer could bet on the leading team holding on, and be right 7 times
    out of 10: a leak the other way.
  - And it inflated the whole scale: 61% of ratings changed, 50+ from 54% to 61%, 100s from 15 to 24, 72
    blowouts turned into close games (some from 4 to 72). Any small early deficit erased now counted.
- **Kept as it is.** To check again later, the leak is the number to watch.

## Next up — Monday

1. **Top priority — cron-job.org, before Tuesday 9 p.m. (first tip-off).** GitHub's own schedule can start
   runs 5 to 20 minutes late; cron-job.org starts the workflow on the minute, every 5 minutes, through the
   GitHub API. GitHub's schedule stays as a fallback.
   - [x] Merge PR #22 first (dispatched runs only redeploy when there's new data).
   - [ ] GitHub token: *Settings → Developer settings → Personal access tokens → Fine-grained*, repository
     `unmissable-nba` only, permission *Actions: Read and write* only, expiration 1 year (date in the calendar).
     Never paste it anywhere else than cron-job.org.
   - [ ] cron-job.org job, every 5 minutes: `POST https://api.github.com/repos/alexischenal/unmissable-nba/actions/workflows/update.yml/dispatches`,
     headers `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `Content-Type: application/json`,
     body `{"ref":"main"}`. Turn on failure e-mails: an expired token fails silently otherwise.
   - [ ] Check: *Actions* shows `workflow_dispatch` runs every 5 minutes (~20 s when idle), cron-job.org gets a 204.
   - Duplicates with GitHub's schedule are harmless: the `data` and `pages` concurrency groups never run twice
     at once, and the script does nothing when the night is up to date.
2. **High priority — fewer, lighter runs (ecological footprint).** ~400 runs a day (cron-job.org every 5 min +
   GitHub every 15 min), ~40–60 kWh a year (rough estimate). Most of it is wasted:
   - [x] **Done (October 21): the schedule is downloaded once per night** (first run after 06:00 New York),
     trimmed to the 4 nights the script can need (a few KB) and kept between runs with `actions/cache`.
     See `scripts/nba/schedule-cache.ts`. Trade-off: a tip-off time changed during the day waits for the next night.
   - [x] **Checked (October 21): 08:00–15:00 UTC is safe for the whole 2026-27 season** (`npm run check-window`).
     Latest tip-offs 04:00 UTC (runs needed until ~08:00), earliest 15:30 UTC (SAS@NOP, January 17).
     GitHub's schedule follows it. **cron-job.org: to set by hand** (every 5 min, hours 0–7 and 15–23, time zone
     UTC). Re-run the check when next season's schedule comes out.
   - [ ] ~~**A daily window with no runs at all.**~~ No NBA game can end between the latest finish (~1:30 a.m. ET with
     overtime, ~06:30 UTC) and the earliest tip-off (noon ET on weekends and holidays = 16:00 UTC in summer time,
     17:00 UTC in winter; games in Europe tip around 19:00–20:00 local time = 18:00–19:00 UTC).
     Candidate: no runs from 08:00 to 15:00 UTC, on cron-job.org and in GitHub's schedule (`*/15 15-23,0-7 * * *`).
     About 30% fewer runs. To check against the season's real schedule before switching it on:
     `npm run check-window`, on your own machine, lists every game of the season that needs runs inside the
     window. A game caught in it isn't lost, only rated later (the next run catches up on the night).
   - [x] **GitHub's own schedule down to once an hour** (October 21, `7 0-7,15-23 * * *`): it's only the fallback.
   - With all three: under ~20 kWh a year.
3. **High priority — "Night of X" and "Next", no "Previous".** Unmissable isn't an archive: one night on
   screen, plus a peek at the next one. Two pages, never more.
   - **Done (October 21)**: `/next`, the logo linking home, `next.json` written on every run, "Next night"
     hidden when the next night has no games. The switch moved into a burger menu (too eye-catching in the
     header): the header only says where you are, the menu links to the other night.
     Still to do: the 24-hour expiry and the "No more games" screen.
   - **Home page**: `Night of October 20–21` (plain: it's where you are) · `Next` (underlined: a link).
   - **Next page**: the opposite. `Night of October 20–21` underlined (link back home) · `Next` plain.
     The label is always the home page night, so the link says where it leads.
   - **URL: `unmissable.watch/next`.** GitHub Pages only serves files that exist, so the build copies
     `dist/index.html` to `dist/next/index.html` (one line after `vite build`); the app reads
     `location.pathname` to know which page it's on. No router library needed for two pages.
   - **If "Next" isn't obvious enough as a link**: underlined and in white. Decide at design time.
   - **The logo (`UNMISSABLE` in the header) links to the home page**, on the Next page and everywhere else.
     The burger menu has the link too.
   - **"Next night" = the next night with games** (changed October 21): days off and the All-Star break are
     skipped, so it carries its date: "Next night · October 23–24" in the menu and on the Next page header.
     No night left in the schedule (end of the season): no link.
   - **The home page night expires after 24 hours.** It stays on screen until the next night's first tip-off,
     but if no new night has started 24 hours after it ended (day off, All-Star break, off-season), the home
     page switches to the "No more games" screen (GIFs).
   - **The site restarts on its own** at the next night's first tip-off: that night becomes the home page.
   - **Next page content**: the "Coming up" cards only (tip-off times in the visitor's time zone), neutral,
     no rating. Details in the "Next night" page section below.
   - **Data**: the script publishes `public/data/next.json` (teams + tip-off times, nothing else), from the
     schedule read once a day (see item 2). When the next night's first game tips off, it becomes the home page.
   - Replaces the old three-night idea (Yesterday / Tonight / Tomorrow with two arrows).
4. **High priority — learn container queries (`cqi` and friends).** Pure CSS, no JavaScript, no cost at load
   time: `1cqi` = 1% of the width of the nearest container (`container-type: inline-size`). Already used on the
   site: `.card__side` is a container, and the team names on phones are `20cqi`. Also: `cqw`, `cqh`, `cqmin`,
   and `@container` rules (styles that depend on a component's own width, not the screen's).
   Reading: MDN, "CSS container queries" (https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries),
   section "Container query length units".
   - [ ] First use case: on the featured card, on phones, size the watermark abbreviation (`.card__abbr`) in `cqi`
     instead of `card height × 0.95`, so the three letters always fill their half (today it's a happy accident at
     ~396px wide). Abbreviations differ in width (OKC vs LAL): close, not pixel-perfect.
5. **Redirect `unmissable.am` → `unmissable.watch`** — low priority: nobody knows the `.am`, and the site is
   `noindex`. At OVH: remove the GitHub A/AAAA/`www` records, add a visible permanent (301) redirect for
   `unmissable.am` and `www.unmissable.am`. OVH's redirect has no HTTPS (https://unmissable.am would show a
   certificate error); Cloudflare's free plan if that ever matters. Keep the `_github-pages-challenge` TXT
   record in the meantime: it stops anyone else from claiming the domain on GitHub Pages.
6. **High priority — the repo as a showcase (job hunt).** It's the first thing a recruiter sees.
   - [ ] **About** (gear icon next to "About" on the repo page): the link still says `unmissable.am` →
     `https://unmissable.watch/`. Description: "Last night's NBA games, rated without spoilers."
     Topics: `react`, `typescript`, `vite`, `scss`, `nba`, `github-actions` (GitHub shows TypeScript, not
     React: React is a library, the code is `.tsx`).
   - [ ] **`.idea/` is committed** (JetBrains config): remove it from the repo (`git rm -r --cached .idea`),
     add `.idea/` to `.gitignore`. Local files stay.
   - [ ] **Merged branches** (54): delete them, and turn on *Settings → General → Automatically delete head
     branches* so GitHub cleans up after every merge.
   - [x] **`how-it-works.txt` brought up to date** (October 27): rating v2 (clutch, late lead changes), the
     lower start of games close only after Q3, no "Every morning". Polish it when the presentation page is
     built. Ingredients only, never the settings.
   - [ ] **"Contributors: Claude"** shows on the repo page (from the `Co-Authored-By` lines). Decide whether
     that's fine for the portfolio. Removing it from past commits means rewriting the whole history (heavy,
     risky): the realistic option is only to stop adding the line from now on.
   - The "main branch isn't protected" banner: harmless for a personal project, dismiss it.
7. **High priority — accessibility (audit of October 21: axe-core, keyboard, structure).**
   - [x] **Header label contrast**: "Night of…" / "Next night" was `$muted` (`#5c5a55`) on black, 3.04:1. Now white
     (October 29): 21:1.
   - [ ] **City name on some reds: 4.34:1** (4.5 needed, small text): white on ATL/POR `#E03A3E`, and on the Sixers'
     red when they switch colors (PHI@NYK). Team names (large text) pass. Fixing means darkening those reds very
     slightly, away from the official colors: decide whether the 0.16 gap is worth it.
   - [ ] **Move `<header>` out of `<main>`**: inside it, screen readers don't announce it as the site's banner.
   - [ ] **Headings for screen readers**: no `h2` before the rated games, none on the Next page. Add visually hidden
     ones (e.g. "Last night's games", "Next night's games"): screen reader users navigate by headings.
   - [ ] **Test with a real screen reader** (VoiceOver on iPhone, 5 minutes): automated tools only catch part of it.
   - Already fine: keyboard (burger, menu, Escape back to the burger, closed menu unreachable), visible focus,
     `lang="en"`, every card described ("1. Boston Celtics at Detroit Pistons, rated 76 out of 100").
   - False positive to ignore: the big watermark abbreviations (decorative, `aria-hidden`), flagged by axe anyway.

8. **High priority — count historic defensive nights in the performance points.** A great defensive night is
   worth watching, and the efficiency we use only sees blocks and steals. Real defensive data, game by game:
   - **Matchups** (camera tracking): per defender, the points scored by the players he guarded, their shots
     and their shooting. The only real defensive data per game.
   - **Hustle stats**: deflections, contested shots, charges drawn, loose balls (counted by hand, less reliable).
   - **The blocker: both live on `stats.nba.com`, not on the CDN we use.** That API is known for not answering
     requests from cloud servers (GitHub Actions), not verified for us. First step: a one-off workflow, run by
     hand, that asks for one past game's matchups and only logs whether it answers, how fast, and how many
     players. Touches neither the site nor the data; delete it afterwards. Run it a few times: if it fails, drop
     the matchups.
   - **Fallback on the CDN**: the play-by-play we already fetch has a few defensive actions the efficiency
     doesn't count (charges and offensive fouls drawn). Much poorer, but no new source.
   - Then: a defensive bonus next to the efficiency, same principle (only what happened on the court, the same
     scale for every player), tested on the past season before going to production.

9. **Medium priority — update the page without F5.** Today the data is loaded once and the card states are
   frozen at load (`LOADED_AT`). Real cases: a tab found again the next morning (mobile browsers often show it
   as it was, without reloading), and the page left open next to something else on a second screen.
   **No banner, nothing added to the page.**
   - **Back on the page** (`visibilitychange`: tab shown again, window restored, phone unlocked): reload
     `latest.json` and `next.json`.
   - **Click on a page that was already visible** (`focus`): same reload. Coming back to a tab fires both:
     one request only (ignore a second trigger within a few seconds).
   - **Page visible but not focused** (second screen): check every 5 minutes (the runs' pace; GitHub Pages
     caches about 10 minutes anyway) and apply right away: ratings appear, cards change groups.
   - **Page in use** (scroll, click, keys): wait until it loses focus, or a minute without interaction. Never
     move a card under the finger or the mouse.
   - **New ratings count in the tab title**: "(2) Unmissable", games rated since the visitor last looked.
     Reset on `focus` / `visibilitychange`. Spoils nothing. Desktop only (no tab titles on phones). Needs the
     check to keep running while the tab is hidden: a small JSON every 5 minutes, browsers throttle
     background timers anyway.
   - Card states (upcoming → live → rated) are recomputed on each update, not only at load.
   - **To think over: a "last updated" in the header again.**
     - Without the auto update, it's needed: the only way to know the page is stale ("Updated 9 h ago" → F5).
     - With it, the page is never stale when looked at. It would only reassure, or explain a gap ("Last rating
       1 h ago": no game ended since), and the "In progress" cards already say that. Its one real use left:
       the network or the script fails and the page silently stops updating. Option: show something only then
       ("Couldn't check for new ratings").
     - Only the time of the last new data is known (the last run that wrote something). The time of the last
       check would mean writing the JSON on every run, so a commit and a deploy every 5 minutes: exactly what
       the lighter runs removed. Hence a label like "Last rating 12 min ago", not "Updated".
     - Relative time (see the rule in "Product"), recomputed on each update. Room at 320px: a small grey
       line, or in the burger menu.
     - To decide: what should the visitor understand, "the page is fresh" or "nothing happened since"?

---

Ideas parked for later. Nothing below is needed for v1.

## Empty states (with GIFs)

Rules for every GIF: official GIPHY embed (no self-hosted copy), the light video version
(MP4/WebM) rather than the .gif, alt text, and a still image under `prefers-reduced-motion`.
Pick one at random among several so returning visitors don't always see the same one.

- **No more games** — shown when the home page night is over 24 hours old and no new night has started
  (day off, All-Star break, off-season), until the next night's first tip-off. Also for an old link to an empty
  night. Same GIF rotation.
  **With a "Next night · February 18–19" button** (from `next.json`, same style as the menu link), so a break
  says when the games come back. No button when the schedule has no night left (off-season).
- **No games last night** (All-Star break, off days)
  - **Nick Young celebrating a three that misses.** The user opened the site sure there'd be a game… and there isn't.
    Copy idea: *"You were so sure. No games last night."* Favourite: basketball, and original.
  - **John Travolta looking around an empty room** (*Pulp Fiction*). Literally the emptiness.
  - **Crying Jordan.** The sports despair classic (a bit overused).
  - **"Oh, the vast emptiness" (*Futurama*).** The user's pick for the moments with nothing to show. A character
    watches the universe literally come to an end, says *"Oh, the vast emptiness"* and shakes his empty beer can;
    another one answers *"I can take a hint"* and hands him a full one. Perfect for "no games": nothing left to
    watch… so grab a drink. From *The Late Philip J. Fry* (the end-of-the-universe episode).
    Use the official GIPHY version of the scene.
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
  - **Left**: "unmissable.watch", link to the home page (= the current night).
  - **Centre**: "Last update X min ago", with the night label ("Night of October 20–21") just under it.
  - **Right**: the night switch, "Night of X" and "Next" side by side (see "Next up").
  - **As the screen narrows, items move into the burger** (the "priority+" pattern): on mobile, none of it fits.
    On mobile, keep only **the burger, the name and the night switch**; "Last update" goes into the burger.
  - **Navigating from night to night updates the header**: the night label and "Last update" always describe
    the night on screen (each night's JSON carries its own date and `updatedAt`).
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
  - **How the rating works** — a page of its own, from `how-it-works.txt`. Its name, to pick among:
    **The Playbook** (working title: a team's book of plays, "how we play"), **Chalk Talk** (the coach at the
    whiteboard), **Film Room** (where players rewatch games), **Why 100?**.
    **Opening pitch** (top of that page, and the social preview text): one question, asked on both sides
    of the Atlantic — is this game worth an effort? In Europe, the effort is the alarm at 6 a.m. instead of
    7:30. In the US, it's dodging spoilers all day at work, until the replay in the evening. On the West Coast,
    a third one, the same evening: East Coast games tip at 4 p.m. Pacific and are over by ~6:30 p.m., so
    coming home from work, you already know whether one is worth watching from tip-off (the site rates each
    game as soon as it ends). Talk about those situations, not about the product. Drafts:
    > **Was last night worth it?**
    > In Europe: worth setting the alarm for 6 a.m.?
    > In the US: worth dodging spoilers all day?
    > Every game rated on what happened on the court. No score, no winner.

    Shorter: **Worth the early alarm? Worth avoiding spoilers all day?** Last night's games, rated without the score.
  - **Next night** (link to `/next`; on the Next page, the link back to the home page instead).
  - **Legal notice** (mandatory in France, even for a personal site): publisher (name, or a contact with the
    details left with the host), host (GitHub, with its address), no cookies, visit counter without personal
    data, **"Not affiliated with the NBA"** (it was in the footer until October 21: removed, this page is now
    its only place), a line on team names and the data used. To check with the official wording before launch.
- **Footer removed (October 21)**: it said "Not affiliated with the NBA. Ratings only measure what happened on
  the court." The first sentence moves to the legal notice, the second to the presentation page.
  Option if the disclaimer ever needs to be more visible: a small footer with a "Legal notice" link only,
  so it's one click away on every page.

- **Tags per game** (tap a card to reveal them). Only on-court facts, never prestige ("top clash", rivalry…).
  Rate each tag's spoiler risk; a spoiler tag needs an explicit second action.
- **Reveal the score on tap**, as a deliberate action (never on hover or scroll).
- **Other sports**: the home page becomes "best game of the night, all sports", sports move to `/basketball`, `/football`…
- **Dark mode.**
- **Low priority — notify when a game reaches 80 or more.** Fits the three use cases (6 a.m. alarm in Europe,
  a day without spoilers in the US, coming home on the West Coast). No server on GitHub Pages, and no
  personal data wanted (legal notice: "none"), so in this order:
  1. **ntfy.sh** (free, open source): the workflow sends one `curl` to a public topic when a game is rated
     80+. Users subscribe in the ntfy app; nothing is stored on our side. Three topics (`unmissable-80`,
     `-90`, `-100`) let each user pick a threshold. Quiet hours are set in the app. About half a day.
  2. **An RSS feed** of 80+ games, written by the script next to the JSON. Static, free, works with any reader.
  3. **Real web push**, only if the site takes off: needs a backend storing subscriptions (personal data,
     GDPR, legal notice to update), and on iPhone only works once the site is added to the home screen.
     Hard to undo: don't start here.
  Never notify a game twice, and never the score: the title is the matchup, the body the rating.
- **Eventually — the burger on phones, in whole pixels.** On phones the brand is fluid (`min(24px, 6.2vw)`),
  so the burger (in em of it) lands between pixels: each bar has the same total weight, but spread over
  different rows (the middle one blurrier). Barely visible on 3x screens. Fix like tablets: a fixed-size
  drawing in whole pixels (e.g. 16px tall: 2px bars, 5px gaps), at the cost of a small height mismatch with
  the brand on some widths. Desktop (40px) and tablets (32px, own drawing) are already pixel-exact.
- **Eventually — the brand as an SVG** (the "UNMISSABLE" letters as paths, like the favicon). Pros: its exact
  height is known (no font metrics), so burger alignment needs no tuning; it looks the same in every browser,
  and doesn't wait for the web font. It doesn't fix the burger issue above by itself: that comes from fluid
  sizes, not from the font. Keep a text alternative (`<h1>` with `aria-label`, or a visually hidden text).

## Food for thought

Ideas to think over, not tasks.

- **A fixed-size brand on phones, so everything in the header lands on whole pixels.** Today the brand is
  fluid on phones (`min(24px, 6.2vw)`), and the burger follows it between pixels. With fixed sizes, the
  burger gets its own whole-pixel drawing, like on tablets. No SVG needed: font or SVG, what matters is the
  fixed size. Two options:
  - **20px on every phone**: capitals 16px tall, burger 16px (2px bars, 5px gaps). Fits at 320px (the brand
    is already 19.8px there) and stays smaller than the team names everywhere. On big phones (390–430px) the
    brand goes from 24 to 20px: a bit quieter than today.
  - **Two steps**: 20px up to 389px, 25px above (capitals 20px, burger 2px bars, 7px gaps). Bigger on big
    phones, a bit more CSS.

## Updates during the day — rate each game as soon as it ends

Goal: games that end in the European evening (US weekend afternoons, Christmas Day, NBA Cup,
games played in Europe…) should be rated right away, not the next morning.
"As soon as it ends, you know whether it's worth watching."

- **Run often, rate game by game — done (October 19).** The workflow wakes up every 15 minutes; the night appears
  at its first tip-off, each game is rated as soon as it's over (three card states: upcoming / live / rated).
  - Check statuses with the light scoreboard file
    (`https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`) rather than the full schedule.
  - GitHub scheduled runs can start a few minutes late: "as soon as it ends" means within ~15–30 min.
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
  Same "Next night · …" button as the "No more games" screen: the first night after the break (`next.json` already
  skips the All-Star games, gameId prefix `003`).
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
  *Actions → Update and deploy → Enable workflow* if GitHub disabled it.
- **NBA data**: quick test run at the start of the season — the schedule file switches to the new season.

## Algorithm v2 — play-by-play data

**Done (October 22).** Each game's play-by-play is fetched when it's rated:
- **Suspense** = time spent within 5 points in the last 5 minutes of Q4 and of every overtime (the NBA's
  "clutch"), instead of the final margin, often inflated by late free throws (e.g. CHA@BKN, October 21:
  final margin 7, but 9 at 2:00 and no clutch at all: 67 → 58).
- **Close-game test**: also close with enough clutch, or a small margin at 2:00, whatever the final margin
  (BKN@SAS, DAL@DET, DET@TOR in 2025-26).
- **Scenario**: lead changes and ties weighted by when they happened (early ones count less).
- Settings in the secret (`clutch`, `swings`). The site waits for a complete play-by-play (its last score =
  the final score), up to 4 hours after tip-off; without it, the game is rated with v1.
- Evaluated on 2025-26 with `npm run season-stats -- 2025-26 --clutch` (v1 vs v2), and night by night
  with `npm run explain -- <date>` (`--v1` for the old rating).

What follows is the original note.

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
- **Favicon — done (October 19)**: a plain dark square with "100" in the display font (no border, square corners),
  as `favicon.svg`, `favicon.ico` and `apple-touch-icon.png`. Still to do: a social preview image (link shared on
  WhatsApp, Messenger…) with the same mark, neutral, nothing about results.
- **Visit counter — the simplest and least invasive possible: GoatCounter.**
  - One `<script>` line in `index.html`, free for non-commercial use, open source, no cookies, no personal data
    stored, no cross-site tracking. Gives the essentials only: visits per day, pages, referrers, screen sizes.
  - No consent banner expected for this kind of tool (to double-check against the CNIL's conditions).
  - Even lighter option: GoatCounter can count with a tiny image instead of JavaScript.
  - Alternatives considered: Cloudflare Web Analytics (needs a Cloudflare account), Umami (more to set up).

## "Next night" page — details

Now high priority (see "Next up"). The site could also become the place to check
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
- **Navigation: see "Next up" — "Night of X" and "Next", no "Previous".**

## Launch

- Remove the `noindex` meta in `index.html` and allow crawling in `public/robots.txt`.
- README for the portfolio: screenshot, the zero-spoiler architecture, the adapter, the two-step algorithm,
  and how it differs from Thuuz (2014 app that rated game excitement live; Unmissable is for the morning after).
