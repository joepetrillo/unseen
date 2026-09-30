import { db } from "#lib/server/db/index.ts";

import type { PageServerLoad } from "./$types";

// Runs only on the server (hence `.server.ts`), so it can use the database.
// The returned object becomes `data` in +page.svelte, typed via ./$types.
export const load: PageServerLoad = async () => {
  const movies = await db.query.movies.findMany({
    columns: { id: true, title: true, releaseDate: true, posterPath: true },
    with: { genres: { columns: { name: true }, orderBy: { name: "asc" } } },
    orderBy: { voteCount: "desc", id: "asc" },
  });
  return { movies };
};
