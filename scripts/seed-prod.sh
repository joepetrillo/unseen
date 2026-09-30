#!/usr/bin/env bash
# Seeds the Production database from this machine: `bun run db:seed:prod`.
#
# Not `vercel env run -e production`: it overlays the local .env.local (the dev
# database URLs) on Production's values, so it would silently seed dev. Instead,
# pull Production's values into a temp file, keep only its database URLs, and
# list that after .env.local: later --env-file files win, so Production's URLs
# replace the dev ones while everything else (the TMDB token) comes from
# .env.local. Production Secrets pull as empty, so they must not override.
set -euo pipefail

all="$(mktemp)"
db="$(mktemp)"
trap 'rm -f "$all" "$db"' EXIT

vercel env pull "$all" --environment=production --yes >/dev/null
grep '^DATABASE_URL' "$all" > "$db"
bun --env-file=.env.local --env-file="$db" scripts/seed-movies.ts
