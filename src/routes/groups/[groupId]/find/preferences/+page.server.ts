import { error } from "@sveltejs/kit";
import { z } from "zod";

import { preferencesFromQuery } from "#lib/deck-fields.ts";
import { db } from "#lib/server/db/index.ts";
import { getGroupForMember } from "#lib/server/groups.ts";
import { requireUser } from "#lib/server/require-user.ts";

import type { PageServerLoad } from "./$types";

// "In the mood for": tonight's preferences, picked here and carried back to
// the deck in its URL. Nothing is saved.
export const load: PageServerLoad = async ({ params, locals, url }) => {
  const user = requireUser(locals);
  const groupId = z.uuid().safeParse(params.groupId);
  const group = groupId.success
    ? await getGroupForMember(db, groupId.data, user.id)
    : null;
  if (group === null) error(404, "Group not found.");
  return {
    group: { id: group.id, name: group.name },
    preferences: preferencesFromQuery(url.searchParams),
    genres: await db.query.genres.findMany({ orderBy: { name: "asc" } }),
  };
};
