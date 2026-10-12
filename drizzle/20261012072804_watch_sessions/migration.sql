CREATE TYPE "watch_answer" AS ENUM('seen', 'not_seen');--> statement-breakpoint
CREATE TYPE "watch_session_role" AS ENUM('host', 'guest');--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'watch_session_start';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'watch_session_end';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'watch_answer_seen';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'watch_answer_not_seen';--> statement-breakpoint
ALTER TYPE "action_type" ADD VALUE 'watch_answer_undo';--> statement-breakpoint
CREATE TABLE "group_past_matches" (
	"group_id" uuid,
	"movie_id" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_past_matches_pkey" PRIMARY KEY("group_id","movie_id")
);
--> statement-breakpoint
CREATE TABLE "watch_session_answers" (
	"participation_id" uuid,
	"movie_id" integer,
	"answer" "watch_answer" NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_session_answers_pkey" PRIMARY KEY("participation_id","movie_id")
);
--> statement-breakpoint
CREATE TABLE "watch_session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"watch_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "watch_session_role" NOT NULL,
	"joined_at" timestamp with time zone,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "watch_sessions" (
	"id" uuid PRIMARY KEY,
	"group_id" uuid NOT NULL,
	"max_runtime" integer,
	"min_year" integer,
	"max_year" integer,
	"genre_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "watch_session_id" uuid;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "participation_id" uuid;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "max_runtime" integer;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "min_year" integer;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "max_year" integer;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "genre_ids" integer[];--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "replaced_watch_session_id" uuid;--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "undone_by_action_id" uuid;--> statement-breakpoint
ALTER TABLE "seen_movies" ADD COLUMN "last_confirmed_by_action" uuid;--> statement-breakpoint
CREATE INDEX "actions_participation_id_idx" ON "actions" ("participation_id","created_at") WHERE "participation_id" is not null;--> statement-breakpoint
CREATE INDEX "movies_vote_count_idx" ON "movies" ("vote_count");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_session_participants_current_key" ON "watch_session_participants" ("watch_session_id","user_id") WHERE "removed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "watch_session_participants_one_host_key" ON "watch_session_participants" ("watch_session_id") WHERE "role" = 'host';--> statement-breakpoint
CREATE INDEX "watch_session_participants_user_id_idx" ON "watch_session_participants" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_sessions_one_active_key" ON "watch_sessions" ("group_id") WHERE "closed_at" is null;--> statement-breakpoint
CREATE INDEX "watch_sessions_group_id_idx" ON "watch_sessions" ("group_id");--> statement-breakpoint
ALTER TABLE "group_past_matches" ADD CONSTRAINT "group_past_matches_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "group_past_matches" ADD CONSTRAINT "group_past_matches_movie_id_movies_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id");--> statement-breakpoint
ALTER TABLE "watch_session_answers" ADD CONSTRAINT "watch_session_answers_jw9DrTKxzOh4_fkey" FOREIGN KEY ("participation_id") REFERENCES "watch_session_participants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "watch_session_answers" ADD CONSTRAINT "watch_session_answers_movie_id_movies_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id");--> statement-breakpoint
ALTER TABLE "watch_session_participants" ADD CONSTRAINT "watch_session_participants_j1AHKgVxp5h8_fkey" FOREIGN KEY ("watch_session_id") REFERENCES "watch_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "watch_session_participants" ADD CONSTRAINT "watch_session_participants_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "watch_sessions" ADD CONSTRAINT "watch_sessions_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;