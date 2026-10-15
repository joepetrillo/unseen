import { preferencesFromQuery } from "#lib/deck-fields.ts";
import { db } from "#lib/server/db/index.ts";

import type { PageServerLoad } from "./$types";

// "In the mood for": tonight's preferences, picked here and carried back to
// the deck in its URL. Nothing is saved.
export const load: PageServerLoad = async ({ parent, url }) => {
  // The layout's membership check first (see ../../+layout.server.ts).
  await parent();
  return {
    preferences: preferencesFromQuery(url.searchParams),
    genres: await db.query.genres.findMany({ orderBy: { name: "asc" } }),
  };
};
