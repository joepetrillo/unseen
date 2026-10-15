-- Watch sessions are gone, so their log entries can't be retried or undone
-- any more. Deleting them clears the way for the next deploy, which drops the
-- log's watch-session columns and these action types.
DELETE FROM "actions" WHERE "type" IN (
  'watch_session_start',
  'watch_session_end',
  'watch_session_join',
  'watch_session_filters',
  'watch_answer_seen',
  'watch_answer_not_seen',
  'watch_answer_undo'
);
