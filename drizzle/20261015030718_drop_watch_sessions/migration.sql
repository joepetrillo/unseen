ALTER TABLE "watch_session_answers" DROP CONSTRAINT "watch_session_answers_jw9DrTKxzOh4_fkey";--> statement-breakpoint
ALTER TABLE "watch_session_participants" DROP CONSTRAINT "watch_session_participants_j1AHKgVxp5h8_fkey";--> statement-breakpoint
DROP TABLE "group_past_matches";--> statement-breakpoint
DROP TABLE "watch_session_answers";--> statement-breakpoint
DROP TABLE "watch_session_participants";--> statement-breakpoint
DROP TABLE "watch_sessions";--> statement-breakpoint
DROP INDEX "actions_participation_id_idx";--> statement-breakpoint
DROP TYPE "watch_answer";--> statement-breakpoint
DROP TYPE "watch_session_role";