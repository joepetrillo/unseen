# Project Spec: Group "Unseen Movie" Finder

Full product spec and decision log. `CLAUDE.md` holds the short, always-loaded rules; this file holds the details and the reasoning behind them. Update it when decisions change.

**Design principle for correctness:** prefer deriving state from a few stored facts over storing and syncing extra state. Simple but strong.

## 1. The product

**Problem:** finding something to watch as a group takes too long.

**Core idea:** the app finds movies that **nobody in the group has seen**. It does NOT judge whether people _want_ to watch them. Picking from the result is up to the group, outside the app.

**Principle:** users should do the least possible. One simple action at a time. No long lists to think through.

Movies only. US region only (release dates, age ratings). TV shows are a possible later addition.

### Users and groups

- Users sign up and can join multiple groups (group cap around 20 members, not final).
- Each user has ONE personal **seen list**, tied to the user, shared across all their groups.
- Only "seen" is stored per user. **"Not seen" is NOT remembered across sessions** (keeps data simple and never stale). Re-asking about popular movies is an accepted cost.
- A movie missing from someone's seen list means **unknown**, never "not seen".

### Sessions

- **One active session per group.** Tapping **Find a movie** while one is active offers **Resume** or **Start fresh** (which closes the old one).
- The person who starts it is the **host** and picks **who's watching tonight** (a subset of the group). Solo sessions are allowed.
- Optional filters (see Filters). **Changing filters starts a new session.**
- Sessions **auto-close after 24 hours** without activity. The timer resets only on successful user changes (answers, undo, participant changes), never on reads, polling, or duplicate retries. The host can close one anytime. Closed sessions reject all changes.

### Answering

1. The app deals a deck: movies matching filters, minus anything any participant has seen.
2. Each participant answers on their own device, one movie at a time, with two big buttons: **Seen** / **Not seen**. Swipe gestures are an optional extra, never the only input. No hearts, crosses, or like/dislike styling.
   - **Seen** adds the movie to that user's seen list and eliminates it from the session. Others see this on their next refresh (a few seconds).
   - A Seen answer on a movie someone else already eliminated **still updates your seen list**. A late Not seen on an eliminated movie is ignored.
3. A movie is a **match** when every current participant has answered **Not seen** and none of them has it in their seen list. Matches are derived from answers only; filters and catalog data decide only what gets dealt next, so a catalog sync can't break an existing shortlist.
4. At **5 matches** the app prompts the group to review the shortlist. Not a hard stop: the first match is viewable as soon as it exists, and people can keep going ("Find more").
5. People can answer at different times and resume where they left off.

### Session states (show the right one)

Each is a distinct message and UI state:

- **You're caught up:** you've answered everything available; others still have work.
- **Waiting for others:** candidates exist that only need other participants' answers. Show who hasn't answered. Never suggest loosening filters here.
- **No eligible movies:** the filtered pool is truly exhausted. Suggest which filter to loosen, based on actual remaining counts.
- **Something failed:** a request error. Distinguish "saving…" from "failed, retry".

### Participants

- Joining a running session requires the person to **accept the invite**. That's the only confirmation; it has nothing to do with answering movies.
- The host can **remove** a participant. Removing someone **deletes their answers in that session**, and matches recalculate from the remaining participants.
- Each join is a separate **participation** (its own ID). Rejoining starts fresh, and requests tied to an earlier participation are rejected.
- A session always has at least one participant. If the host leaves the session or group, the longest-standing participant becomes host; if nobody is left, the session closes. Leaving a group removes the person from that group's active session.
- Inactivity is never treated as "Not seen".

### Deck ordering

Sort key, in order:

1. **Previously matched movies last:** movies that were matches when one of this group's earlier sessions closed. Only history recorded **before this session started** counts, so another session can't reshuffle this one.
2. **Most Not seen confirmations** from other participants first ("finish what's started"), so each answer is likely to complete a match.
3. **TMDB vote count**, descending (a proxy for how well-known a movie is; well-known movies are most likely seen, so they get eliminated fast).
4. **Movie ID** as a stable tie-breaker.

Other rules:

- **No cursors or page offsets.** Each fetch asks for "the top few eligible movies I haven't answered, excluding the ones already on my screen." Rankings shift as people answer, so a saved position would skip movies.
- The card a person is looking at never changes under them. If someone else eliminates it meanwhile, skip it with a short note.
- Minimum vote count floor to avoid obscure titles. Unreleased movies (US) excluded.
- TMDB **popularity** (a daily activity score) and TMDB **trending** (separate day/week lists) are different metrics. Neither is used in v1.
- **Validate the ordering** once real data exists: measure time to first match and answers needed to reach 5 matches.

### Past-match history

- Recorded **only when a session closes**: whatever is a match at that moment is saved for the group. Matches undone before closing are never recorded. Reading data never records history.

### Filters (v1)

- **Runtime** (max minutes), **genre**, **release year** (range), **TMDB rating** (minimum).
- Multiple genres mean **any of** (OR).
- Movies missing runtime or rating are excluded only when that filter is active.
- Later: actor (and whether it means top-billed only), age rating, trending mode.

### Fixing mistakes and managing data

- **Undo** is always visible while answering. Each person has their own undo stack **per session**; repeated undo steps back through that person's actions in that session only.
  - Undoing a Seen removes the seen entry only if **this action was the last one to confirm it**. If a later action (another session, the My Seen Movies page) confirmed it again, the entry stays.
  - Undoing a Not seen withdraws that confirmation, so the movie may leave the shortlist.
- **"Actually, I've seen this"** on shortlist items.
- **My Seen Movies** page: search by title, filter (genre, year, etc.), remove entries.
- **Removing a seen entry lets your earlier Not seen answers count again.** They were your own answers, so if the Seen was a mistake, they're correct. (Deliberate rule; no extra invalidation logic.)
- All seen-list changes (answers, undo, corrections, page edits) go through **one server module**.
- Always show year and poster (remakes share titles).
- **Where to watch:** an external link only (e.g. TMDB's watch page), with no promise the movie is actually available.

### Scope

**v1:** auth, groups, one active session per group with Resume/Start fresh, host and "who's watching tonight", invites, host removal, host transfer, 24-hour auto-close, v1 filters, Seen/Not seen answering, shortlist with review prompt and Find more, deck ordering including past-match deprioritizing, per-session undo, shortlist correction, My Seen Movies page, the four session states, unreleased excluded, where-to-watch link.

**Later:** optional warm-up for new users (about 50 most-rated movies), Letterboxd CSV import, "allow 1 person who's seen it" leniency for big groups (off by default), actor/age-rating/trending filters, IMDb/Rotten Tomatoes scores via OMDb, verified streaming availability, real-time updates, TV shows.

## 2. Movie data: TMDB with our own catalog copy

- Source: **TMDB** (The Movie Database), a free community API. Its vote counts are smaller than IMDb's, but its relative order is good enough for "how well-known" ordering and a basic rating filter.
- TMDB cannot exclude our users' seen movies, so filtering happens on our side.
- **Chosen approach: keep our own copy of the catalog in Postgres.** TMDB is never called during a user session.
- **Seed:**
  - TMDB discover results stop at 500 pages, so split discovery into partitions (e.g. by release year, smaller ranges where needed) so each stays under the limit.
  - Discovery results and ID exports are not full records, so enrich each movie separately with a details request (runtime, genres, US certification, IMDb ID, etc.).
  - Run the first seed locally (too long for serverless).
- **Refresh (scheduled, GitHub Actions):**
  - Use TMDB's changes feed for edited movies, but **do not assume it covers vote-count changes**; verify, and refresh vote counts/ratings on a separate periodic job.
  - Periodically re-discover to catch movies newly crossing the vote floor and new US releases.
  - Sync must be **resumable** (records progress), **manually runnable**, and **monitored** (failed or missed runs alert).
- Store: title, year, US release date, runtime, genres, US certification, rating average, vote count, poster path, IMDb ID, last-synced time.
- Posters load directly from TMDB's image CDN; store only the path.
- **Before launch:** read TMDB's API terms (attribution, data storage rules).
- Rejected: fetching from TMDB live and filtering page by page. Too many API calls, slow for users with big seen lists.

## 3. Data model (starting point, to refine together)

- **users** (+ `seen_version` counter), plus Better Auth's own tables
- **groups**, **group_members** (role: owner/member)
- **movies** (catalog copy), **movie_genres**
- **seen** (user, movie, created_at, `last_confirmed_by_action`), unique per user+movie, indexed by user
- **sessions** (group, host, filters, status active/closed, `revision` counter, last_activity_at); at most one active per group (partial unique index)
- **session_participants** — one row per participation (ID, session, user, status invited/active/removed, joined_at)
- **session_answers** (participation, movie, answer), unique per participation+movie; current answers only
- **actions** — action log for idempotency and undo: action ID (client-generated, primary key), user, participation, type (seen / not_seen / undo / seen_list_remove / …), movie, payload hash, result, undone flag, created_at. Reusing an action ID with a different payload fails.
- **group_past_matches** (group, movie, recorded_at), written when a session closes
- The **shortlist is derived**, never stored.

## 4. Correctness rules

- **Authorization:** each operation checks the permission it needs. Answering and undo require an active participation; accepting an invite requires a pending invite; viewing a session (including closed ones) requires group membership; seen-list edits only need to be your own list; host actions require being host. The acting user always comes from the login session, never from request data.
- **Idempotency:** every mutation carries a client-generated **action ID**. Retrying a request that already succeeded returns the stored result and changes nothing.
- **Transactions:** each mutation (answer, undo, participant change, seen-list edit) runs in one transaction that bumps **every counter it affects**. A Seen answer changes both the session and the user's seen list, so it bumps `sessions.revision` and `users.seen_version`.
- **Stale requests:** answers carry their participation ID and movie ID. Requests for an old participation or a closed session are rejected. A late Not seen on an eliminated movie is ignored; a Seen always updates the seen list.
- **Driver:** Neon's HTTP driver can't do interactive transactions; use the Neon serverless (WebSocket) driver with Drizzle for transactional writes. Confirm current guidance at setup.
- **Required tests:** simultaneous answers on the same movie, retry after a successful save, action ID reused with different input, undo conflicts (Seen confirmed again elsewhere), cross-session seen updates, participant removal and rejoin, host leaving, stale poll responses, session closure.

## 5. Updates between users: polling, designed to be swappable

- v1 uses **polling**, not WebSockets. Small groups, a few seconds of delay is fine, and Vercel serverless can't hold WebSocket connections. WebSockets would still need all of the consistency logic below (phones drop connections), plus a separate service and channel auth. Revisit only if real use shows the delay bothers people.
- **Change detection with a fingerprint:** the poll compares a small fingerprint built from the session's `revision` plus each active participant's `seen_version`. A seen-list change bumps only that user's counter, and every session they're in notices automatically. No cross-session writes or locking.
- When the fingerprint changed, the server returns full state and the new fingerprint from **one consistent read**.
- The client applies only the response to its **latest** request. Polls never overlap.
- **Coordinate polling with saves:** while a save is in flight, pause polling and discard any refresh response that started before the save, so it can't overwrite the save's result. Refresh once the save completes. Poll every 2–3 seconds while a session screen is open and visible; pause when backgrounded; back off when nothing changes; refresh immediately on focus/reconnect.
- An unchanged fingerprint gets a tiny "no change" response.
- A user's own answer response returns fresh state; polling only catches other people's changes.
- **Swappable boundaries:**
  - Server: `notifySessionChanged(sessionId)`, called on session changes (bumps revision). Seen-list changes bump `seen_version` in the seen-list module.
  - Client: `subscribeToSession(sessionId, onChange)`, polls and reloads only when the fingerprint changed.
  - Switching to a real-time service (Ably/Pusher/PartyKit, or self-hosted WebSockets + Redis pub/sub) means rewriting only these boundaries; the fingerprint logic stays as the safety net.

## 6. Tech stack (decided)

| Area             | Choice                                                                                          | Why                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Framework        | Svelte 5 + SvelteKit                                                                            | Learning goal                                                                                   |
| Language         | TypeScript (strict)                                                                             |                                                                                                 |
| Styling          | Tailwind CSS                                                                                    |                                                                                                 |
| Components       | shadcn-svelte (built on Bits UI), Bits UI directly for custom pieces                            | Headless, accessible, owned code                                                                |
| Database         | Neon Postgres                                                                                   | Relational data; the deck is a SQL exclusion query                                              |
| DB library       | Drizzle (Neon serverless driver for transactions)                                               | Reads like SQL, so it teaches what's happening                                                  |
| Auth             | Better Auth, **email one-time code only** (email OTP plugin)                                    | Works across devices (read email on laptop, sign in on phone), unlike magic links. No passwords |
| Auth rate limits | Better Auth rate limiting with **database storage**                                             | In-memory limits don't work across serverless instances                                         |
| Hosting          | Vercel                                                                                          | Near-zero config for SvelteKit                                                                  |
| Catalog sync     | GitHub Actions scheduled workflow (first seed run locally)                                      | Free, no serverless time limits                                                                 |
| Tests            | Vitest (unit/integration), Playwright (end-to-end)                                              |                                                                                                 |
| Lint/format      | ESLint (eslint-plugin-svelte + typescript-eslint strict type-checked) + Prettier + svelte-check | See section 9                                                                                   |
| Package manager  | Bun                                                                                             |                                                                                                 |

Not needed for v1: WebSockets or real-time services, Redis, job queues (BullMQ), Kafka, a separate caching layer.

## 7. Open details to decide together

- Minimum vote count value
- Group size cap
- Exact polling intervals and backoff
- Group invite method (link vs. code) and who can invite
- How auto-close runs (checked on read vs. a scheduled job)
- Email provider for login codes (e.g. Resend)

## 8. Next step: project setup

Before the first Claude Code session (done by me):

1. Node.js LTS and a package manager installed.
2. Accounts: GitHub, Neon, TMDB (request an API key), Vercel. An email provider can wait until auth.
3. Project created with `npx sv create` (minimal template, TypeScript). Add Tailwind, Drizzle (PostgreSQL + Neon), Vitest, Playwright, Vercel adapter if offered. Skip ESLint/Prettier (Ultracite handles them) and auth (added later).
4. `CLAUDE.md` in the root, this file at `docs/PROJECT_SPEC.md`, `git init`, first commit.

First session (with Claude Code):

1. Walk me through every generated file and what it does before writing any features.
2. Set up Ultracite (ESLint backend), `svelte-check`, TypeScript strict mode, and environment variables (`.env` plus `.env.example`, never committing secrets). Fill in the Commands section of `CLAUDE.md`.
3. Connect Neon via Drizzle and design the first schema together.

### Build order (one stage at a time)

Design the schema with the whole spec in mind, but build features in stages. Each stage is a clean stopping point: when its "Done when" checks pass, nothing is half-built and nothing needs remembering.

**Every stage ends the same way:** lint, svelte-check, and tests pass; changes committed and deployed to Vercel; the Progress list below updated with the stage status and any follow-ups.

1. **Setup and deploy.** Tooling, strict TypeScript, env vars, CI.
   _Done when:_ the app loads at its Vercel URL, and CI runs lint, svelte-check, and tests green.
2. **Database and small catalog.** Drizzle + Neon, `movies` table, seed script for a few hundred movies.
   _Done when:_ a dev page lists seeded movies with posters, and re-running the seed creates no duplicates.
3. **Auth.** Better Auth with email codes, protected routes.
   _Done when:_ you can sign in with a code on phone and laptop, signed-out users get redirected, and an end-to-end test covers sign-in.
4. **Seen list.** The seen-list module (action IDs, transactions, `seen_version`) and the My Seen Movies page: add from a catalog search, search, filter, remove.
   _Done when:_ the page works on the live site, and tests prove a retried action changes nothing and a reused action ID with different input fails.
5. **Groups and invites.** Create a group, invite someone, permission checks.
   _Done when:_ a second account can join your group, and a test proves non-members can't read or change it.
6. **Solo session.** Session in a group with just you: deck query and ordering, filters, Seen/Not seen, matches, shortlist with "Actually, I've seen this", undo, where-to-watch link.
   _Done when:_ you can find unseen movies alone start to finish, and tests cover deck order, seen exclusion, filters, and undo conflicts.
7. **Group sessions.** Multiple participants, polling fingerprint, the four session states.
   _Done when:_ two browsers on different accounts see each other's answers within seconds and reach a shared match, and tests cover simultaneous answers, stale poll responses, and polling during saves.
8. **Session lifecycle.** Accepting session invites, host removal and transfer, rejoining, Resume/Start fresh, 24-hour auto-close, past matches.
   _Done when:_ each rule in the spec's Participants and Sessions sections has a passing test.
9. **Full catalog sync.** Partitioned seed, enrichment, scheduled GitHub Actions job, alerts.
   _Done when:_ the full catalog is loaded, a scheduled run succeeds, an interrupted run resumes, and a forced failure sends an alert.
10. **Launch.** TMDB attribution and terms check, production email provider, error pages, ordering metrics.
    _Done when:_ you and your brother use it for a real movie night.

### Progress

<!-- Update at the end of each stage: stage number, status, date, follow-ups. -->

- Not started.

## 9. Linting and formatting decision

- **ESLint:** the official Svelte setup (`sv add eslint`: eslint-plugin-svelte, which understands markup, runes, and SvelteKit conventions) upgraded to typescript-eslint's **strictTypeChecked + stylisticTypeChecked** configs.
- **Prettier** with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss` (class sorting reads `src/routes/layout.css`).
- **svelte-check** with `--fail-on-warnings`.
- TypeScript `strict` plus `noUncheckedIndexedAccess`.
- CI (GitHub Actions) runs lint, svelte-check, unit tests, and build on every push and PR.
- **Why not Ultracite:** tried at setup (Sep 2026). Its ESLint Svelte preset didn't configure the Svelte parser (every `.svelte` file failed to parse) and its rules clashed with SvelteKit conventions (`+page.svelte` file names, `.svelte.spec.ts` tests). Its Oxlint backend only lints `<script>` blocks. Revisit if either improves.
