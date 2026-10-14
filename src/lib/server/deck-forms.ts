import { type ActionFailure, fail } from "@sveltejs/kit";
import { z } from "zod";

import { RELOAD } from "#lib/server/forms.ts";
import type { DeckOutcome } from "#lib/server/group-deck.ts";

// Shared by the group deck's form actions (the deck and the group page).

const refusals: Record<
  Exclude<DeckOutcome, "applied" | "duplicate">,
  [status: number, message: string]
> = {
  not_found: [404, "This group is gone, or you're no longer in it."],
  movie_not_found: [404, "That movie is no longer in the catalog."],
  nothing_to_undo: [409, "There's nothing left to undo."],
  // Only a bug or a tampered request reuses an action ID for something else.
  conflict: [409, RELOAD],
};

/**
 * Null when the change is saved ("applied", or "duplicate": a retry of one
 * that already succeeded); otherwise the failure to return. `code` lets the
 * page react to a refusal (say, you left the group) without parsing messages.
 */
export function deckRefusal(
  outcome: DeckOutcome
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

export const movieIdSchema = z
  .string()
  .transform(Number)
  .pipe(z.int().positive());
