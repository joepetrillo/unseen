import { error, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { readForm } from "#lib/server/forms.ts";
import { requireUser } from "#lib/server/require-user.ts";
import {
  excludeSchema,
  watchRefusal,
} from "#lib/server/watch-session-forms.ts";
import {
  answerMovie,
  canUndo,
  dealCards,
  endWatchSession,
  getCard,
  getWatchSession,
  listMatches,
  undoLastAnswer,
} from "#lib/server/watch-sessions.ts";
import { describeFilters, type MovieCard } from "#lib/watch-fields.ts";

import type { Actions, PageServerLoad } from "./$types";

/** What every deck response carries: the next cards and the counts. */
export interface DeckState {
  cards: MovieCard[];
  matchCount: number;
  canUndo: boolean;
}

async function deckState(
  watchSessionId: string,
  participationId: string,
  exclude: readonly number[]
): Promise<DeckState> {
  const [cards, matches, undoable] = await Promise.all([
    dealCards(db, { watchSessionId, participationId, exclude }),
    listMatches(db, watchSessionId),
    canUndo(db, participationId),
  ]);
  return { cards, matchCount: matches.length, canUndo: undoable };
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = requireUser(locals);
  const id = z.uuid().safeParse(params.watchSessionId);
  const session = id.success
    ? await getWatchSession(db, id.data, user.id)
    : null;
  // Same answer for "no such session" and "not your group".
  if (session === null) error(404, "Session not found.");

  const genres = await db.query.genres.findMany({
    where: { id: { in: session.genreIds } },
  });
  const summary = describeFilters(
    session,
    new Map(genres.map((genre) => [genre.id, genre.name]))
  );
  const base = {
    session: {
      id: session.id,
      groupId: session.groupId,
      groupName: session.groupName,
      filters: summary,
      isHost: session.participation?.role === "host",
    },
  };

  if (session.closedAt !== null) {
    return {
      ...base,
      view: "closed" as const,
      matches: await listMatches(db, session.id),
    };
  }
  if (session.participation === null) {
    return { ...base, view: "outside" as const };
  }
  return {
    ...base,
    view: "deck" as const,
    participationId: session.participation.id,
    deck: await deckState(session.id, session.participation.id, []),
  };
};

const movieIdSchema = z.string().transform(Number).pipe(z.int().positive());

const answerSchema = z.object({
  actionId: z.uuid(),
  participationId: z.uuid(),
  movieId: movieIdSchema,
  answer: z.enum(["seen", "not_seen"]),
  exclude: excludeSchema,
});

const undoSchema = z.object({
  actionId: z.uuid(),
  participationId: z.uuid(),
});

function sessionIdFrom(params: { watchSessionId: string }): string {
  const id = z.uuid().safeParse(params.watchSessionId);
  if (!id.success) error(404, "Session not found.");
  return id.data;
}

export const actions = {
  // Answers come from the deck's save queue (deck.svelte.ts), one at a time.
  // Each reply carries fresh cards, so the queue refills as you answer.
  answer: async ({ request, locals, params }) => {
    const user = requireUser(locals);
    const watchSessionId = sessionIdFrom(params);
    const form = await readForm(request, answerSchema);
    if (!form.ok) return form.failure;

    const { exclude, ...change } = form.data;
    const failed = watchRefusal(
      await answerMovie(db, { ...change, userId: user.id, watchSessionId })
    );
    if (failed !== null) return failed;
    return deckState(watchSessionId, change.participationId, exclude);
  },

  undo: async ({ request, locals, params }) => {
    const user = requireUser(locals);
    const watchSessionId = sessionIdFrom(params);
    const form = await readForm(request, undoSchema);
    if (!form.ok) return form.failure;

    const { participationId } = form.data;
    const { outcome, movieId } = await undoLastAnswer(db, {
      ...form.data,
      userId: user.id,
      watchSessionId,
    });
    const failed = watchRefusal(outcome);
    if (failed !== null) return failed;
    // The undone movie goes back on screen in front of the current card; the
    // queue behind it stays, so no new cards are dealt here.
    const [card, matches, undoable] = await Promise.all([
      movieId === null ? null : getCard(db, movieId),
      listMatches(db, watchSessionId),
      canUndo(db, participationId),
    ]);
    return { card, matchCount: matches.length, canUndo: undoable };
  },

  end: async ({ request, locals, params }) => {
    const user = requireUser(locals);
    const watchSessionId = sessionIdFrom(params);
    const form = await readForm(request, z.object({ actionId: z.uuid() }));
    if (!form.ok) return form.failure;

    const session = await getWatchSession(db, watchSessionId, user.id);
    const failed = watchRefusal(
      await endWatchSession(db, {
        actionId: form.data.actionId,
        userId: user.id,
        watchSessionId,
      })
    );
    if (failed !== null) return failed;
    redirect(303, session === null ? "/" : `/groups/${session.groupId}`);
  },
} satisfies Actions;
