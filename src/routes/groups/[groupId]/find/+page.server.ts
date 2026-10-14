import { error } from "@sveltejs/kit";
import { z } from "zod";

import { preferencesFromQuery } from "#lib/deck-fields.ts";
import { db } from "#lib/server/db/index.ts";
import {
  deckRefusal,
  excludeSchema,
  movieIdSchema,
} from "#lib/server/deck-forms.ts";
import { readForm } from "#lib/server/forms.ts";
import {
  answerMovie,
  canUndo,
  countMatches,
  describeDeckPreferences,
  getCard,
  readDeckState,
  undoLastAnswer,
} from "#lib/server/group-deck.ts";
import { getGroupForMember } from "#lib/server/groups.ts";
import { requireUser } from "#lib/server/require-user.ts";

import type { Actions, PageServerLoad } from "./$types";

// The group deck. Tonight's preferences live in this page's URL query
// (?maxRuntime=120&genreIds=35), so they start fresh every time you come
// from the group page and nothing about them is stored.
export const load: PageServerLoad = async ({ params, locals, url }) => {
  const user = requireUser(locals);
  const groupId = z.uuid().safeParse(params.groupId);
  const group = groupId.success
    ? await getGroupForMember(db, groupId.data, user.id)
    : null;
  // Same answer for "no such group" and "not your group".
  if (group === null) error(404, "Group not found.");

  const preferences = preferencesFromQuery(url.searchParams);
  return {
    group: { id: group.id, name: group.name },
    preferences,
    mood: await describeDeckPreferences(db, preferences),
    deck: await readDeckState(db, {
      groupId: group.id,
      userId: user.id,
      preferences,
      exclude: [],
    }),
  };
};

const answerSchema = z.object({
  actionId: z.uuid(),
  movieId: movieIdSchema,
  answer: z.enum(["seen", "not_seen"]),
  exclude: excludeSchema,
});

function groupIdFrom(params: { groupId: string }): string {
  const id = z.uuid().safeParse(params.groupId);
  if (!id.success) error(404, "Group not found.");
  return id.data;
}

export const actions = {
  // Answers come from the deck's save queue (deck.svelte.ts), one at a time.
  // Each reply carries fresh cards, so the queue refills as you answer. The
  // deck posts with its preferences still in the URL, so the reply deals
  // the same way the page does.
  answer: async ({ request, locals, params, url }) => {
    const user = requireUser(locals);
    const groupId = groupIdFrom(params);
    const form = await readForm(request, answerSchema);
    if (!form.ok) return form.failure;

    const { exclude, ...change } = form.data;
    const failed = deckRefusal(
      await answerMovie(db, { ...change, userId: user.id, groupId })
    );
    if (failed !== null) return failed;
    return readDeckState(db, {
      groupId,
      userId: user.id,
      preferences: preferencesFromQuery(url.searchParams),
      exclude,
    });
  },

  undo: async ({ request, locals, params }) => {
    const user = requireUser(locals);
    const groupId = groupIdFrom(params);
    const form = await readForm(request, z.object({ actionId: z.uuid() }));
    if (!form.ok) return form.failure;

    const { outcome, movieId } = await undoLastAnswer(db, {
      actionId: form.data.actionId,
      userId: user.id,
      groupId,
    });
    const failed = deckRefusal(outcome);
    if (failed !== null) return failed;
    // The undone movie goes back on screen in front of the current card; the
    // queue behind it stays, so no new cards are dealt here.
    const [card, matchCount, undoable] = await Promise.all([
      movieId === null ? null : getCard(db, movieId),
      countMatches(db, groupId),
      canUndo(db, user.id, groupId),
    ]);
    return { card, matchCount, canUndo: undoable };
  },
} satisfies Actions;
