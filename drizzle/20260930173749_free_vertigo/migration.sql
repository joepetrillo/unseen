CREATE TABLE "genres" (
	"id" integer PRIMARY KEY,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_genres" (
	"movie_id" integer,
	"genre_id" integer,
	CONSTRAINT "movie_genres_pkey" PRIMARY KEY("movie_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" integer PRIMARY KEY,
	"title" text NOT NULL,
	"release_date" date,
	"us_release_date" date,
	"runtime" integer,
	"us_certification" text,
	"vote_average" real,
	"vote_count" integer NOT NULL,
	"poster_path" text,
	"imdb_id" text,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "movie_genres_genre_id_idx" ON "movie_genres" ("genre_id");--> statement-breakpoint
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_movie_id_movies_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "movie_genres" ADD CONSTRAINT "movie_genres_genre_id_genres_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE;