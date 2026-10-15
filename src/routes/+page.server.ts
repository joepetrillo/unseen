import { eq } from "drizzle-orm";

import { db } from "#lib/server/db/index.ts";
import { seenMovies } from "#lib/server/db/schema.ts";
import { countMatches } from "#lib/server/group-deck.ts";
import { listGroups } from "#lib/server/groups.ts";
import { requireUser } from "#lib/server/require-user.ts";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const user = requireUser(locals);
  const [groups, seenCount] = await Promise.all([
    listGroups(db, user.id),
    db.$count(seenMovies, eq(seenMovies.userId, user.id)),
  ]);
  // One count per group: people are in a handful of groups, and the pool
  // runs these one or two at a time anyway.
  return {
    groups: await Promise.all(
      groups.map(async (group) => ({
        ...group,
        matchCount: await countMatches(db, group.id),
      }))
    ),
    seenCount,
  };
};
