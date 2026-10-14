import { z } from "zod";

import { movieCardSchema } from "#lib/deck-fields.ts";

// The watch sessions' fields (stages 6–7), retired by the group deck in stage
// 8. What they share with it lives in #lib/deck-fields.ts; the old names
// stay here until the session screens are removed.
export {
  describePreferences as describeFilters,
  formatRuntime,
  type MovieCard,
  movieCardSchema,
  NO_PREFERENCES as NO_FILTERS,
  preferencesSchema as watchFiltersSchema,
  REVIEW_PROMPT_AT,
  RUNTIME_CHOICES,
  RUNTIME_MAX,
  whereToWatchUrl,
  type Preferences as WatchFilters,
  YEAR_MAX,
  YEAR_MIN,
} from "#lib/deck-fields.ts";

/**
 * What the deck shows, read at one moment (one database snapshot), so the
 * fingerprint describes exactly these cards and counts. A schema because the
 * poll's reply arrives as JSON the browser checks (watch-session-updates.ts).
 */
export const deckStateSchema = z.object({
  /** The top cards to deal, skipping what the browser already holds. */
  cards: z.array(movieCardSchema),
  matchCount: z.int(),
  canUndo: z.boolean(),
  /** Changes whenever anything the deck shows could have (spec section 5). */
  fingerprint: z.string(),
  /**
   * Set only when you have nothing left to answer: the nicknames of others
   * who still have movies to answer. Empty means nobody does: the filtered
   * pool is used up.
   */
  waitingOn: z.array(z.string()).nullable(),
  /** The session's filters, described (the host can change them). */
  filters: z.string(),
});
export type DeckState = z.infer<typeof deckStateSchema>;

/** The poll's reply (see #lib/watch-session-updates.ts). */
export const pollReplySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unchanged") }),
  z.object({ status: z.literal("changed"), state: deckStateSchema }),
  // The session ended, or you're no longer in it: the page reloads.
  z.object({ status: z.literal("ended") }),
]);
export type PollReply = z.infer<typeof pollReplySchema>;
