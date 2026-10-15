import { preferencesFromQuery } from "#lib/deck-fields.ts";
import { db } from "#lib/server/db/index.ts";
import { deckAction } from "#lib/server/deck-forms.ts";
import {
  answerMovie,
  listMatches,
  listWaitingOn,
  markWatched,
} from "#lib/server/group-deck.ts";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
  // The layout's membership check first (see ../+layout.server.ts).
  const { group } = await parent();
  // Coming from the deck, the URL carries tonight's preferences: the
  // matches that fit them come first, and Find more keeps them.
  const preferences = preferencesFromQuery(url.searchParams);
  const [matches, waitingOn] = await Promise.all([
    listMatches(db, group.id, preferences),
    listWaitingOn(db, group.id, group.me.userId),
  ]);
  return { matches, waitingOn, query: url.searchParams.toString() };
};

export const actions = {
  watched: (event) => deckAction(event, (input) => markWatched(db, input)),
  // "Actually, I've seen this": a Seen answer that replaces your Not seen,
  // on your undo stack like any other answer.
  seen: (event) =>
    deckAction(event, (input) => answerMovie(db, { ...input, answer: "seen" })),
} satisfies Actions;
