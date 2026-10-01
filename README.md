# Unseen

Finds movies nobody in your group has seen. SvelteKit 3 (pre-release), Svelte 5, Drizzle v1, Neon Postgres, deployed on Vercel.

- Product spec, decisions, and build progress: [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)
- Working rules for contributors and coding agents: [`AGENTS.md`](AGENTS.md)

## Setup

Requires Node 24 and [Bun](https://bun.sh).

```sh
bun install
vercel link && vercel env pull   # writes .env.local (see .env.example)
bun run db:migrate
bun run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server |
| `bun run verify` | Lint + svelte-check + unit and database tests (what CI runs, minus the build). Database tests use the dev database and clean up after themselves |
| `bun run test:e2e` | Playwright end-to-end tests against a production build and the dev database |
| `bun run fix` | Format with oxfmt and auto-fix lint issues |
| `bun run outdated:next` | Check pinned pre-release packages (Kit, adapter, Drizzle) for updates |
