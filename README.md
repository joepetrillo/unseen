# Unseen

Finds movies nobody in your group has seen. SvelteKit 3 (pre-release), Svelte 5, Drizzle v1, Neon Postgres, deployed on Vercel.

- Product spec, decisions, and build progress: [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md)
- Working rules for contributors and coding agents: [`AGENTS.md`](AGENTS.md)

## Setup

Requires Node 24 and [Bun](https://bun.sh).

```sh
bun install
cp .env.example .env   # then fill in the values
bun run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server |
| `bun run verify` | Lint + svelte-check + unit tests (what CI runs, minus the build) |
| `bun run test:e2e` | Playwright end-to-end tests against a production build |
| `bun run fix` | Format with oxfmt and auto-fix lint issues |
| `bun run outdated:next` | Check pinned pre-release packages (Kit, adapter, Drizzle) for updates |
