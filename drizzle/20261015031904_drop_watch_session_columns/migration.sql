ALTER TABLE "actions" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "action_type";--> statement-breakpoint
CREATE TYPE "action_type" AS ENUM('seen_list_add', 'seen_list_remove', 'group_create', 'group_join', 'group_leave', 'group_rename', 'group_delete', 'group_reset_invite', 'group_remove_member', 'group_set_nickname', 'answer_seen', 'answer_not_seen', 'answer_undo', 'group_mark_watched', 'group_unmark_watched');--> statement-breakpoint
ALTER TABLE "actions" ALTER COLUMN "type" SET DATA TYPE "action_type" USING "type"::"action_type";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "watch_session_id";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "participation_id";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "max_runtime";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "min_year";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "max_year";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "genre_ids";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "replaced_watch_session_id";--> statement-breakpoint
ALTER TABLE "actions" DROP COLUMN "invited_user_ids";