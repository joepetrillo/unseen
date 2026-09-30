import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Our copy of the TMDB catalog. The deck is dealt from here; TMDB is never
// called during a user session.
export const movies = pgTable("movies", {
  // TMDB's ID, not a generated one: re-syncing the same movie updates its row
  // instead of creating a duplicate.
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  // TMDB's primary release date; the displayed year comes from it.
  // `mode: "string"` keeps it as "YYYY-MM-DD" so time zones can't shift the day.
  releaseDate: date("release_date", { mode: "string" }),
  // Earliest US release. Null means no known US release, so it's never dealt.
  usReleaseDate: date("us_release_date", { mode: "string" }),
  runtime: integer("runtime"),
  usCertification: text("us_certification"),
  voteAverage: real("vote_average"),
  voteCount: integer("vote_count").notNull(),
  posterPath: text("poster_path"),
  imdbId: text("imdb_id"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
});

export const genres = pgTable("genres", {
  // TMDB's genre ID.
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});

export const movieGenres = pgTable(
  "movie_genres",
  {
    movieId: integer("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  // The primary key (movie, genre) already serves lookups by movie; the genre
  // filter needs its own index to go the other way.
  (t) => [
    primaryKey({ columns: [t.movieId, t.genreId] }),
    index("movie_genres_genre_id_idx").on(t.genreId),
  ]
);

export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
