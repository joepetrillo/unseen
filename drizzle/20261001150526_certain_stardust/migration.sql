CREATE TYPE "action_type" AS ENUM('seen_list_add', 'seen_list_remove');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY,
	"user_id" text NOT NULL,
	"type" "action_type" NOT NULL,
	"movie_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seen_movies" (
	"user_id" text,
	"movie_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seen_movies_pkey" PRIMARY KEY("user_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "seen_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "actions_user_id_idx" ON "actions" ("user_id");--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_movie_id_movies_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id");--> statement-breakpoint
ALTER TABLE "seen_movies" ADD CONSTRAINT "seen_movies_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "seen_movies" ADD CONSTRAINT "seen_movies_movie_id_movies_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id");