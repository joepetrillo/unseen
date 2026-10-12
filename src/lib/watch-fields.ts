import { z } from "zod";

// Rules for watch session filters. Shared by the server (which validates) and
// the pages (which offer the same choices and describe them).

/** Offered as "Under 1½ hours", etc. Any whole number up to the max is valid. */
export const RUNTIME_CHOICES = [90, 120, 150] as const;
export const RUNTIME_MAX = 600;
export const YEAR_MIN = 1870;
export const YEAR_MAX = 2100;

export interface WatchFilters {
  maxRuntime: number | null;
  minYear: number | null;
  maxYear: number | null;
  /** Any of these; empty means every genre. Sorted, no duplicates. */
  genreIds: number[];
}

export const NO_FILTERS: WatchFilters = {
  maxRuntime: null,
  minYear: null,
  maxYear: null,
  genreIds: [],
};

// An empty field ("Any") means no limit. Out-of-range values get a message
// written for people (readForm shows it).
function optionalWholeNumber(min: number, max: number, label: string) {
  const error = `Pick a ${label} between ${String(min)} and ${String(max)}.`;
  return z
    .union([z.literal("").transform(() => null), z.coerce.number()])
    .pipe(z.int({ error }).min(min, { error }).max(max, { error }).nullable());
}

/**
 * The start form's filter fields. Genre checkboxes send `genreIds` once per
 * ticked box, so it arrives as nothing, one value, or a list.
 */
export const watchFiltersSchema = z
  .object({
    maxRuntime: optionalWholeNumber(
      1,
      RUNTIME_MAX,
      "length in minutes"
    ).default(null),
    minYear: optionalWholeNumber(YEAR_MIN, YEAR_MAX, "year").default(null),
    maxYear: optionalWholeNumber(YEAR_MIN, YEAR_MAX, "year").default(null),
    genreIds: z
      .union([z.string(), z.array(z.string())])
      .default([])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(
        z
          .array(z.string().transform(Number).pipe(z.int().positive()))
          .max(50)
          // Sorted and deduplicated, so the same choice always compares
          // equal (a retried start must match its first attempt exactly).
          .transform((ids) => [...new Set(ids)].sort((a, b) => a - b))
      ),
  })
  .refine(
    ({ minYear, maxYear }) =>
      minYear === null || maxYear === null || minYear <= maxYear,
    { error: "The first year must come before the last." }
  );

/** "Under 2 hours · Comedy, Drama · 1990–2009", for the collapsed filters. */
export function describeFilters(
  filters: WatchFilters,
  genreNames: ReadonlyMap<number, string>
): string {
  const length =
    filters.maxRuntime === null
      ? "Any length"
      : `Up to ${formatRuntime(filters.maxRuntime)}`;
  const genres =
    filters.genreIds.length === 0
      ? "All genres"
      : filters.genreIds
          .map((id) => genreNames.get(id) ?? "Unknown")
          .join(", ");
  const { minYear, maxYear } = filters;
  const years =
    minYear === null && maxYear === null
      ? "Any year"
      : minYear === null
        ? `Up to ${String(maxYear)}`
        : maxYear === null
          ? `${String(minYear)} or later`
          : minYear === maxYear
            ? String(minYear)
            : `${String(minYear)}–${String(maxYear)}`;
  return [length, genres, years].join(" · ");
}

/** 135 → "2 h 15 min". */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0
    ? `${String(hours)} h`
    : `${String(hours)} h ${String(rest)} min`;
}

/** A movie as the session screens show it. */
export const movieCardSchema = z.object({
  id: z.int(),
  title: z.string(),
  year: z.int().nullable(),
  runtime: z.int().nullable(),
  posterPath: z.string().nullable(),
  genres: z.array(z.string()),
});
export type MovieCard = z.infer<typeof movieCardSchema>;

/** TMDB's US watch page: where TMDB lists streaming, rental, and purchase. */
export function whereToWatchUrl(movieId: number): string {
  return `https://www.themoviedb.org/movie/${String(movieId)}/watch?locale=US`;
}

/** At this many matches the session suggests reviewing the shortlist. */
export const REVIEW_PROMPT_AT = 5;

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
