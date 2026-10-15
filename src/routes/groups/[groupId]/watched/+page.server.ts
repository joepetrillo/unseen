import { db } from "#lib/server/db/index.ts";
import { deckAction } from "#lib/server/deck-forms.ts";
import { listWatched, unmarkWatched } from "#lib/server/group-deck.ts";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent }) => {
  // The layout's membership check first (see ../+layout.server.ts).
  const { group } = await parent();
  return { watched: await listWatched(db, group.id) };
};

export const actions = {
  unwatched: (event) => deckAction(event, (input) => unmarkWatched(db, input)),
} satisfies Actions;
