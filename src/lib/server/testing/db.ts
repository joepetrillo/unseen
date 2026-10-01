import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { inArray } from "drizzle-orm";
import { z } from "zod";

import { createDb, type Db } from "#lib/server/db/client.ts";
import { movies, type NewMovie, users } from "#lib/server/db/schema.ts";

// Shared by tests that need a real database (Vitest and Playwright alike).

/**
 * Locally: the dev database, from .env.local (Vitest and Playwright don't load
 * it into `process.env` the way Vite and Bun do). In CI: a throwaway Postgres
 * (see .github/workflows/ci.yml). Two connections, so tests can run
 * transactions side by side.
 */
export function connectTestDb() {
  if (existsSync(".env.local")) {
    Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));
  }
  const { DATABASE_URL } = z
    .object({
      DATABASE_URL: z.url({
        protocol: /^postgres(ql)?$/,
        error: "DATABASE_URL is not set. Run `vercel env pull`.",
      }),
    })
    .parse(process.env);
  return createDb(DATABASE_URL, 2);
}

/**
 * An ID for a test movie: far above TMDB's IDs (under 2 million today), so it
 * never collides with a real movie.
 */
export function testMovieId(): number {
  return randomInt(1_000_000_000, 2_000_000_000);
}

/**
 * Creates users and movies for a test file and deletes them afterwards, so
 * tests can share the dev database without seeing each other's rows.
 */
export function createFixtures(db: Db) {
  const userIds: string[] = [];
  const movieIds: number[] = [];

  return {
    async user(): Promise<string> {
      const id = crypto.randomUUID();
      // A reserved domain that can't receive mail.
      await db
        .insert(users)
        .values({ id, name: "", email: `${id}@example.test` });
      userIds.push(id);
      return id;
    },

    async movie(fields: Partial<NewMovie> = {}): Promise<number> {
      const id = fields.id ?? testMovieId();
      await db.insert(movies).values({
        title: `Test movie ${String(id)}`,
        voteCount: 0,
        syncedAt: new Date(),
        ...fields,
        id,
      });
      movieIds.push(id);
      return id;
    },

    // Users first: deleting them cascades to their seen movies and actions,
    // which would otherwise block deleting the movies.
    async cleanUp(): Promise<void> {
      if (userIds.length > 0) {
        await db.delete(users).where(inArray(users.id, userIds));
      }
      if (movieIds.length > 0) {
        await db.delete(movies).where(inArray(movies.id, movieIds));
      }
    },
  };
}
