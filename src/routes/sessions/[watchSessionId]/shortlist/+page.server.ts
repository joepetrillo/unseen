import { error } from "@sveltejs/kit";
import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { readForm } from "#lib/server/forms.ts";
import { requireUser } from "#lib/server/require-user.ts";
import { watchRefusal } from "#lib/server/watch-session-forms.ts";
import {
  answerMovie,
  getWatchSession,
  listMatches,
} from "#lib/server/watch-sessions.ts";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = requireUser(locals);
  const id = z.uuid().safeParse(params.watchSessionId);
  const session = id.success
    ? await getWatchSession(db, id.data, user.id)
    : null;
  if (session === null) error(404, "Session not found.");
  return {
    session: {
      id: session.id,
      groupName: session.groupName,
      closed: session.closedAt !== null,
    },
    // Corrections need an active participation in an open session.
    participationId:
      session.closedAt === null ? (session.participation?.id ?? null) : null,
    matches: await listMatches(db, session.id),
  };
};

const correctionSchema = z.object({
  actionId: z.uuid(),
  participationId: z.uuid(),
  movieId: z.string().transform(Number).pipe(z.int().positive()),
});

export const actions = {
  // "Actually, I've seen this": a Seen answer that replaces the Not seen, so
  // it's on the undo stack like any other answer.
  seen: async ({ request, locals }) => {
    const user = requireUser(locals);
    const form = await readForm(request, correctionSchema);
    if (!form.ok) return form.failure;
    return (
      watchRefusal(
        await answerMovie(db, { ...form.data, userId: user.id, answer: "seen" })
      ) ?? undefined
    );
  },
} satisfies Actions;
