import {
  bigint,
  boolean,
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

// Better Auth's tables, from `bunx auth generate` (Better Auth 1.7, email OTP
// plugin, database rate limits, `usePlural`). Better Auth reads and writes
// them; our code only references `users`. Re-run the generator after changing
// auth plugins or options, and compare. Timestamps are `timestamptz` like ours
// (the generator emits plain `timestamp`).
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Login sessions (the cookie points at a row here). Not to be confused with
// watch sessions, the group movie-finding sessions.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)]
);

// Linked sign-in methods (OAuth providers, passwords). Email codes don't use
// it, but Better Auth requires the table.
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)]
);

// Pending sign-in codes, keyed by `identifier` (e.g. "sign-in-otp-<email>").
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)]
);

// Request counters per IP and path. In memory they'd reset on every
// serverless instance, so they live here.
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  // Milliseconds since the epoch, as Better Auth writes it.
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export type User = typeof users.$inferSelect;

// Our own per-address limit on sign-in code emails (see
// #lib/server/sign-in-code-limit.ts). Better Auth's rate limits are per IP,
// and people in one room share an IP. One row per address ever used.
export const signInCodeLimits = pgTable("sign_in_code_limits", {
  email: text("email").primaryKey(),
  windowStartedAt: timestamp("window_started_at", {
    withTimezone: true,
  }).notNull(),
  count: integer("count").notNull(),
});
