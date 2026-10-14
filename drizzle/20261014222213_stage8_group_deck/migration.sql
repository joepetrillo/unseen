ALTER TYPE "action_type" ADD VALUE 'answer_seen';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'answer_not_seen';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'answer_undo';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'group_mark_watched';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'group_unmark_watched';--> statement-breakpoint
CREATE TABLE "group_watched_movies" (
	"group_id" uuid,
	"movie_id" integer,
	"marked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_watched_movies_pkey" PRIMARY KEY("group_id","movie_id")
);
--> statement-breakpoint
CREATE TABLE "not_seen_movies" (
	"user_id" text,
	"movie_id" integer,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_confirmed_by_action" uuid NOT NULL,
	CONSTRAINT "not_seen_movies_pkey" PRIMARY KEY("user_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "actions_user_group_idx" ON "actions" ("user_id","group_id","created_at") WHERE "group_id" is not null;--> statement-breakpoint
ALTER TABLE "group_watched_movies" ADD CONSTRAINT "group_watched_movies_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_watched_movies" ADD CONSTRAINT "group_watched_movies_movie_id_movies_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id");--> statement-breakpoint
ALTER TABLE "group_watched_movies" ADD CONSTRAINT "group_watched_movies_marked_by_users_id_fkey" FOREIGN KEY ("marked_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "not_seen_movies" ADD CONSTRAINT "not_seen_movies_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "not_seen_movies" ADD CONSTRAINT "not_seen_movies_movie_id_movies_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id");