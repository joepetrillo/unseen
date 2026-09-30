import { defineRelations } from "drizzle-orm";

import * as schema from "./schema.ts";

// Relations only shape relational queries (`db.query.*`); they don't create
// database constraints. `through` hides the junction table, so a movie's
// `genres` are genre rows, not movie_genres rows.
export const relations = defineRelations(schema, (r) => ({
  movies: {
    genres: r.many.genres({
      from: r.movies.id.through(r.movieGenres.movieId),
      to: r.genres.id.through(r.movieGenres.genreId),
    }),
  },
  genres: {
    movies: r.many.movies(),
  },
}));
