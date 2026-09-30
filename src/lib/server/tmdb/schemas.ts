import { z } from "zod";

// Only the fields we use. Zod drops unknown keys, so TMDB adding fields never
// breaks parsing; a missing or retyped field fails loudly instead of storing junk.

export const genreSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export const genreListSchema = z.object({
  genres: z.array(genreSchema),
});

export const discoverPageSchema = z.object({
  page: z.number().int(),
  total_pages: z.number().int(),
  results: z.array(z.object({ id: z.number().int() })),
});

const releaseDateSchema = z.object({
  certification: z.string(),
  // ISO timestamp, e.g. "2010-07-16T00:00:00.000Z".
  release_date: z.string(),
  // 1 premiere, 2 limited theatrical, 3 theatrical, 4 digital, 5 physical, 6 TV.
  type: z.number().int(),
});

export const movieDetailsSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  // TMDB uses "" (not null) when a date is unknown.
  release_date: z.string(),
  // TMDB uses 0 or null when the runtime is unknown.
  runtime: z.number().int().nullable(),
  genres: z.array(genreSchema),
  vote_average: z.number(),
  vote_count: z.number().int(),
  poster_path: z.string().nullable(),
  imdb_id: z.string().nullable(),
  // Present because we request it with `append_to_response=release_dates`.
  release_dates: z.object({
    results: z.array(
      z.object({
        iso_3166_1: z.string(),
        release_dates: z.array(releaseDateSchema),
      })
    ),
  }),
});

export type TmdbGenre = z.infer<typeof genreSchema>;
export type TmdbMovieDetails = z.infer<typeof movieDetailsSchema>;
