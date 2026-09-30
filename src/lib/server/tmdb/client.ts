import type { z } from "zod";

import {
  discoverPageSchema,
  genreListSchema,
  movieDetailsSchema,
} from "./schemas.ts";

const BASE_URL = "https://api.themoviedb.org/3";
const MAX_ATTEMPTS = 4;

// Only sync scripts use this. The app never calls TMDB during a user session.
export function createTmdbClient(readAccessToken: string) {
  async function get<T extends z.ZodType>(
    path: string,
    params: Record<string, string>,
    schema: T
  ): Promise<z.infer<T>> {
    const url = `${BASE_URL}${path}?${new URLSearchParams(params).toString()}`;
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${readAccessToken}`,
          Accept: "application/json",
        },
      });
      if (response.ok) return schema.parse(await response.json());

      // 429 = rate limited, 5xx = TMDB hiccup: both are worth retrying.
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) {
        throw new Error(`TMDB ${path} returned ${String(response.status)}`);
      }
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const delayMs =
        retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    genres: () =>
      get("/genre/movie/list", { language: "en-US" }, genreListSchema),

    // Most-voted first: our deck ordering proxy for "well-known".
    discoverByVoteCount: (page: number) =>
      get(
        "/discover/movie",
        {
          sort_by: "vote_count.desc",
          include_adult: "false",
          include_video: "false",
          language: "en-US",
          page: String(page),
        },
        discoverPageSchema
      ),

    // Discover results lack runtime, IMDb ID, and US release info; this adds them.
    movieDetails: (id: number) =>
      get(
        `/movie/${String(id)}`,
        { language: "en-US", append_to_response: "release_dates" },
        movieDetailsSchema
      ),
  };
}
