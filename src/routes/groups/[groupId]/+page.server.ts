import { db } from "#lib/server/db/index.ts";
import { countMatches, listWatched } from "#lib/server/group-deck.ts";

import type { PageServerLoad } from "./$types";

// The group's hub: a short page that leads to everything else. Each list
// lives on its own screen (matches, watched, members, settings), so a long
// one never pushes the rest out of reach.
export const load: PageServerLoad = async ({ parent, url }) => {
  // The layout's membership check first (see +layout.server.ts).
  const { group } = await parent();
  const [matchCount, watched] = await Promise.all([
    countMatches(db, group.id),
    listWatched(db, group.id),
  ]);
  return {
    matchCount,
    watchedCount: watched.length,
    // Shown here only while you're alone in the group: inviting is the next
    // step. After that, it lives on the members screen.
    inviteUrl: `${url.origin}/join/${group.inviteCode}`,
  };
};
