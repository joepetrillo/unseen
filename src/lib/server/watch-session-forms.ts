import { type ActionFailure, fail } from "@sveltejs/kit";
import { z } from "zod";

import { RELOAD } from "#lib/server/forms.ts";
import type { WatchSessionOutcome } from "#lib/server/watch-sessions.ts";

// Shared by the watch session pages' form actions.

const refusals: Record<
  Exclude<WatchSessionOutcome, "applied" | "duplicate">,
  [status: number, message: string]
> = {
  not_found: [404, "This session is gone, or you're no longer in its group."],
  not_host: [403, "Only the person who started the session can do that."],
  session_active: [409, "This group already has a session going."],
  session_closed: [409, "This session has ended."],
  not_participating: [403, "You're no longer in this session."],
  movie_not_found: [404, "That movie is no longer in the catalog."],
  nothing_to_undo: [409, "There's nothing left to undo."],
  // Only a bug or a tampered request reuses an action ID for something else.
  conflict: [409, RELOAD],
};

/**
 * Null when the change is saved ("applied", or "duplicate": a retry of one
 * that already succeeded); otherwise the failure to return. `code` lets the
 * page react to a refusal (say, a closed session) without parsing messages.
 */
export function watchRefusal(
  outcome: WatchSessionOutcome
): ActionFailure<{ message: string; code: string }> | null {
  if (outcome === "applied" || outcome === "duplicate") return null;
  const [status, message] = refusals[outcome];
  return fail(status, { message, code: outcome });
}

/**
 * Movie IDs the browser already holds (on screen or waiting to save), sent
 * comma-separated so the next deal skips them.
 */
export const excludeSchema = z
  .string()
  .default("")
  .transform((value) => (value === "" ? [] : value.split(",")))
  .pipe(
    z.array(z.string().transform(Number).pipe(z.int().positive())).max(100)
  );
