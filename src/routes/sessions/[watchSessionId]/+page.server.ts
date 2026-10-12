import { error, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { readForm } from "#lib/server/forms.ts";
import { requireUser } from "#lib/server/require-user.ts";
import {
  excludeSchema,
  visibleSchema,
  watchRefusal,
} from "#lib/server/watch-session-forms.ts";
import {
  answerMovie,
  canUndo,
  countMatches,
  describeSessionFilters,
  endWatchSession,
  getActiveWatchSessionId,
  getCard,
  getWatchSession,
  joinWatchSession,
  listMatches,
  listParticipants,
  readDeckState,
  undoLastAnswer,
} from "#lib/server/watch-sessions.ts";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = requireUser(locals);
  const id = z.uuid().safeParse(params.watchSessionId);
  const session = id.success
    ? await getWatchSession(db, id.data, user.id)
    : null;
  // Same answer for "no such session" and "not your group".
  if (session === null) error(404, "Session not found.");

  const base = {
    session: {
      id: session.id,
      groupId: session.groupId,
      groupName: session.groupName,
      filters: await describeSessionFilters(db, session),
      isHost: session.participation?.role === "host",
    },
  };

  if (session.closedAt !== null) {
    // The group's session now, if you're in it or invited (after Change
    // filters, say), so the ended screen can lead there.
    const activeId = await getActiveWatchSessionId(db, session.groupId);
    const active =
      activeId === null ? null : await getWatchSession(db, activeId, user.id);
    return {
      ...base,
      view: "closed" as const,
      matches: await listMatches(db, session.id),
      current:
        active !== null &&
        (active.participation !== null || active.invitation !== null)
          ? active.id
          : null,
    };
  }
  if (session.invitation !== null) {
    const people = await listParticipants(db, session.id);
    return {
      ...base,
      view: "invited" as const,
      participationId: session.invitation.id,
      host: people.find((person) => person.role === "host")?.nickname ?? null,
      joined: people
        .filter((person) => person.joined)
        .map((person) => person.nickname),
    };
  }
  if (session.participation === null) {
    return { ...base, view: "outside" as const };
  }
  return {
    ...base,
    view: "deck" as const,
    participationId: session.participation.id,
    deck: await readDeckState(db, {
      watchSessionId: session.id,
      participationId: session.participation.id,
      exclude: [],
      visible: null,
    }),
  };
};

const movieIdSchema = z.string().transform(Number).pipe(z.int().positive());

const answerSchema = z.object({
  actionId: z.uuid(),
  participationId: z.uuid(),
  movieId: movieIdSchema,
  answer: z.enum(["seen", "not_seen"]),
  exclude: excludeSchema,
  visible: visibleSchema,
});

// Undo and join name the participation, nothing else.
const participationSchema = z.object({
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

    const { exclude, visible, ...change } = form.data;
    const failed = watchRefusal(
      await answerMovie(db, { ...change, userId: user.id, watchSessionId })
    );
    if (failed !== null) return failed;
    return readDeckState(db, {
      watchSessionId,
      participationId: change.participationId,
      exclude,
      visible,
    });
  },

  undo: async ({ request, locals, params }) => {
    const user = requireUser(locals);
    const watchSessionId = sessionIdFrom(params);
    const form = await readForm(request, participationSchema);
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
    const [card, matchCount, undoable] = await Promise.all([
      movieId === null ? null : getCard(db, movieId),
      countMatches(db, watchSessionId),
      canUndo(db, participationId),
    ]);
    return { card, matchCount, canUndo: undoable };
  },

  // Accepting an invitation. Success reloads the page, which shows the deck.
  join: async ({ request, locals, params }) => {
    const user = requireUser(locals);
    const watchSessionId = sessionIdFrom(params);
    const form = await readForm(request, participationSchema);
    if (!form.ok) return form.failure;
    const failed = watchRefusal(
      await joinWatchSession(db, {
        ...form.data,
        userId: user.id,
        watchSessionId,
      })
    );
    if (failed !== null) return failed;
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
