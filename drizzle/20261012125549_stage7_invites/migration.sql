ALTER TYPE "action_type" ADD VALUE 'watch_session_join' BEFORE 'watch_answer_seen';--> statement-breakpoint
ALTER TABLE "actions" ADD COLUMN "invited_user_ids" text[];