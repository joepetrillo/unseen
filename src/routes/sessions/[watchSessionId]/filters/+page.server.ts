import { error, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { readForm } from "#lib/server/forms.ts";
import { requireUser } from "#lib/server/require-user.ts";
import { watchRefusal } from "#lib/server/watch-session-forms.ts";
import {
  changeWatchSessionFilters,
  getWatchSession,
} from "#lib/server/watch-sessions.ts";
import { watchFiltersSchema } from "#lib/watch-fields.ts";

import type { Actions, PageServerLoad } from "./$types";

// Change filters (host only): the same session with new filters, so its
// people, answers, and matches stay.
export const load: PageServerLoad = async ({ params, locals }) => {
  const user = requireUser(locals);
  const id = z.uuid().safeParse(params.watchSessionId);
  const session = id.success
    ? await getWatchSession(db, id.data, user.id)
    : null;
  if (session === null) error(404, "Session not found.");
  // Anyone else (or an ended session, or an old link) goes back to the
  // session, which shows what they can do there.
  if (session.closedAt !== null || session.participation?.role !== "host") {
    redirect(303, `/sessions/${session.id}`);
  }

  return {
    session: { id: session.id, groupName: session.groupName },
    filters: {
      maxRuntime: session.maxRuntime,
      minYear: session.minYear,
      maxYear: session.maxYear,
      genreIds: session.genreIds,
    },
    genres: await db.query.genres.findMany({ orderBy: { name: "asc" } }),
  };
};

const changeSchema = z.object({ actionId: z.uuid() }).and(watchFiltersSchema);

export const actions = {
  change: async ({ request, locals, params }) => {
    const user = requireUser(locals);
    const watchSessionId = z.uuid().safeParse(params.watchSessionId);
    if (!watchSessionId.success) error(404, "Session not found.");
    const form = await readForm(request, changeSchema);
    if (!form.ok) return form.failure;

    const { actionId, ...filters } = form.data;
    const failed = watchRefusal(
      await changeWatchSessionFilters(db, {
        actionId,
        userId: user.id,
        watchSessionId: watchSessionId.data,
        filters,
      })
    );
    if (failed !== null) return failed;
    redirect(303, `/sessions/${watchSessionId.data}`);
  },
} satisfies Actions;
