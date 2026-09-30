# Unseen Movie Finder

SvelteKit app that finds movies nobody in a group has seen. Full spec, scope, and decision reasoning: `docs/PROJECT_SPEC.md`. Read it before planning any feature, and update it when a decision changes.

## How to work with me

- I'm an Angular/React developer learning Svelte 5 and SvelteKit. Act as a mentor: explain decisions in plain language, give options with tradeoffs and a recommendation, and ask my opinion before locking in anything significant.
- Work in small steps. Follow the build order in spec section 8 and don't implement ahead of the current stage. Check the Progress list there to see where we are. A stage is done only when its "Done when" checks pass; then commit, deploy, and update Progress. Before a stage, explain the concepts it teaches; after writing code, explain what each piece does and why. Point out where Svelte differs from Angular/React.
- Be concise. No filler.
- Svelte 5, SvelteKit, Better Auth, and Drizzle change fast: check current docs rather than relying on memory.

## Stack

SvelteKit 3 (pre-release) (Svelte 5, TypeScript strict) · Tailwind · shadcn-svelte / Bits UI · Neon Postgres · Drizzle v1 (release candidate) · Better Auth (email one-time code only) · Vercel · GitHub Actions (catalog sync) · Vitest · Playwright · ESLint (eslint-plugin-svelte + typescript-eslint strict type-checked) · oxfmt · svelte-check · Bun

## Pre-release versions (easy to get wrong from memory)

Most tutorials and training data use SvelteKit 2 and Drizzle 0.x. Use the new APIs:

- **SvelteKit 3:** import from `#lib/...` with file extensions (`#lib/server/db/index.ts`), not `$lib`. Use `$app/env`, not `$app/environment`; `$app/state`, not `$app/stores`. Declare env vars in `src/env.ts` (`defineEnvVars`) and import them from `$app/env/private` or `$app/env/public`. Docs: https://next.svelte.dev/docs/kit. No remote functions (still experimental).
- **Drizzle v1:** `drizzle({ client, relations })`, relations via `defineRelations`, relational queries v2. Docs: https://orm.drizzle.team (v1 pages). Better Auth uses `@better-auth/drizzle-adapter/relations-v2`.
- Kit, the Vercel adapter, drizzle-orm, and drizzle-kit are pinned to exact versions. `bun outdated` can't see their updates; run `bun run outdated:next` at the start of each stage. Upgrade deliberately, in pairs (kit + adapter-vercel, drizzle-orm + drizzle-kit), then `bun run verify`.

## Code rules

- No `any`; use `unknown` and narrow. Validate all external input (forms, URL params, TMDB responses) with a schema library and derive types from the schemas.
- Use SvelteKit's generated `$types`, Drizzle schema types, and typed `$props`.
- Svelte 5 runes only. Use `$effect` only when nothing else works.
- Server-only code (database, secrets, TMDB) lives in `src/lib/server` (imported as `#lib/server/...`). Forms use form actions with `use:enhance`.
- Comments explain _why_ and non-obvious logic, not what the code says. Briefly explain Svelte-specific patterns.
- Never commit secrets. Keep `.env.example` in sync with `.env`.

## Architecture rules (easy to get wrong)

- Prefer deriving state from stored facts over storing extra state.
- Database: `pg` pool via Drizzle's `node-postgres` driver, created once at module level (max 1–2), `DATABASE_URL` = Neon pooled string, `DIRECT_URL` for drizzle-kit only, registered with `attachDatabasePool`. Details: spec section 5b.
- Server code runs on Vercel Fluid compute: one instance serves many requests at once. Never keep per-request or per-user data in module-level variables; use `event.locals`. Shared clients (e.g. the database pool) belong at module level.
- TMDB is never called during a user session. The deck comes from our own `movies` catalog table, kept updated by a scheduled sync job.
- Only "seen" is stored per user. "Not seen" lives only in `session_answers`. A missing seen entry means unknown, never not seen.
- Matches are derived: every current participant answered Not seen and none has it in their seen list. Never stored; filters and catalog data don't affect existing matches.
- One active session per group. Closed sessions reject all changes.
- Deck order: previously matched last, then most confirmations, then TMDB **vote count** (not "popularity"), then movie ID. No cursors or offsets: fetch the top eligible unanswered movies, excluding ones already on screen.
- Every server operation checks the permission it needs (answering requires an active participation; see spec section 4). The acting user comes from the auth session, never from request data.
- Every mutation carries a client action ID (logged in `actions`) and runs in one transaction that bumps every affected counter (`sessions.revision` and/or `users.seen_version`).
- All seen-list changes go through one server module.
- Live updates go through `notifySessionChanged()` (server) and `subscribeToSession()` (client). Polling compares a fingerprint of session revision + participants' seen versions; nothing else may poll or depend on the mechanism.

## Commands

Package manager is **bun**.

- `bun run dev` — dev server
- `bun run verify` — lint + svelte-check + unit tests (run before finishing any change)
- `bun run outdated:next` — check pinned pre-release packages for updates (run at the start of each stage)
- `bun run lint` / `bun run fix` — check / auto-fix formatting and lint
- `bun run check` — svelte-check (type errors in markup, compiler and a11y warnings; warnings fail)
- `bun run test:unit --run` / `bun run test:e2e` — Vitest / Playwright
- `bun run build` — production build
- `bun run db:generate` / `db:migrate` / `db:push` / `db:studio` — Drizzle

## Before finishing any change

Run `bun run verify` (plus e2e tests when relevant) and show the results. Fix root causes; don't suppress errors.
