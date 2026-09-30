/**
 * Loads the most-voted movies from TMDB into our catalog. Safe to re-run:
 * rows are keyed by TMDB ID and upserted, so a second run updates in place
 * and inserts nothing.
 *
 * Run: `bun run db:seed` (DATABASE_URL from .env.local, so the dev database).
 * Production's catalog is owned by the scheduled sync job (stage 9), not this.
 * TMDB_READ_ACCESS_TOKEN is a Development-only Secret on Vercel (the deployed
 * app never calls TMDB), pulled into .env.local with the database URLs.
 */
import { count, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { createDb } from "#lib/server/db/client.ts";
import { genres, movieGenres, movies } from "#lib/server/db/schema.ts";
import { createTmdbClient } from "#lib/server/tmdb/client.ts";
import type { TmdbGenre } from "#lib/server/tmdb/schemas.ts";
import { toMovieRow } from "#lib/server/tmdb/to-movie-row.ts";

// TMDB returns 20 movies per discover page.
const PAGES = 15;
// Parallel detail requests; TMDB allows roughly 50 per second.
const CONCURRENCY = 8;

// Scripts run outside SvelteKit, so src/env.ts doesn't apply; validate here.
const env = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    TMDB_READ_ACCESS_TOKEN: z.string().min(1),
  })
  .parse(process.env);

const tmdb = createTmdbClient(env.TMDB_READ_ACCESS_TOKEN);
const { pool, db } = createDb(env.DATABASE_URL, 1);

/** Runs `fn` over `items` with at most `limit` calls in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      // `index` is always in range here, but noUncheckedIndexedAccess can't know that.
      results[index] = await fn(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function main(): Promise<void> {
  // Dev and Production are different Neon endpoints; show which one we write to.
  console.log(`Seeding ${new URL(env.DATABASE_URL).hostname}`);
  const { genres: genreList } = await tmdb.genres();

  // Rankings can shift between page requests, so a movie may appear twice.
  const ids = new Set<number>();
  for (let page = 1; page <= PAGES; page++) {
    const { results } = await tmdb.discoverByVoteCount(page);
    for (const { id } of results) ids.add(id);
  }
  console.log(`Discovered ${String(ids.size)} movies; fetching details…`);

  const syncedAt = new Date();
  const detailed = await mapWithConcurrency([...ids], CONCURRENCY, (id) =>
    tmdb.movieDetails(id)
  );
  const rows = detailed.map((details) => toMovieRow(details, syncedAt));

  // Include genres seen on movies in case TMDB's genre list lags behind, so the
  // movie_genres foreign key never fails.
  const allGenres = new Map<number, TmdbGenre>();
  for (const genre of [...genreList, ...detailed.flatMap((d) => d.genres)]) {
    allGenres.set(genre.id, genre);
  }

  // One transaction: a failure part-way leaves the catalog exactly as it was.
  const upserted = await db.transaction(async (tx) => {
    await tx
      .insert(genres)
      .values([...allGenres.values()])
      .onConflictDoUpdate({
        target: genres.id,
        set: { name: sql.raw(`excluded.${genres.name.name}`) },
      });

    const result = await tx
      .insert(movies)
      .values(rows.map((r) => r.movie))
      .onConflictDoUpdate({
        target: movies.id,
        set: {
          title: sql.raw(`excluded.${movies.title.name}`),
          releaseDate: sql.raw(`excluded.${movies.releaseDate.name}`),
          usReleaseDate: sql.raw(`excluded.${movies.usReleaseDate.name}`),
          runtime: sql.raw(`excluded.${movies.runtime.name}`),
          usCertification: sql.raw(`excluded.${movies.usCertification.name}`),
          voteAverage: sql.raw(`excluded.${movies.voteAverage.name}`),
          voteCount: sql.raw(`excluded.${movies.voteCount.name}`),
          posterPath: sql.raw(`excluded.${movies.posterPath.name}`),
          imdbId: sql.raw(`excluded.${movies.imdbId.name}`),
          syncedAt: sql.raw(`excluded.${movies.syncedAt.name}`),
        },
      })
      // Postgres trick: `xmax` is 0 only for rows this statement inserted, so
      // this tells new rows apart from updated ones.
      .returning({ inserted: sql<boolean>`xmax = 0` });

    // Replace each movie's genres wholesale, so genres TMDB removed disappear too.
    const movieIds = rows.map((r) => r.movie.id);
    await tx.delete(movieGenres).where(inArray(movieGenres.movieId, movieIds));
    await tx
      .insert(movieGenres)
      .values(
        rows.flatMap((r) =>
          r.genreIds.map((genreId) => ({ movieId: r.movie.id, genreId }))
        )
      );

    return result;
  });

  const inserted = upserted.filter((r) => r.inserted).length;
  const [movieTotal] = await db.select({ n: count() }).from(movies);
  const [linkTotal] = await db.select({ n: count() }).from(movieGenres);
  console.log(
    `Movies: ${String(inserted)} inserted, ${String(upserted.length - inserted)} updated.`
  );
  console.log(
    `Totals: ${String(movieTotal?.n)} movies, ${String(allGenres.size)} genres, ${String(linkTotal?.n)} movie-genre links.`
  );
}

try {
  await main();
} finally {
  await pool.end();
}
