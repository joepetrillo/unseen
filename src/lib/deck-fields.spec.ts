import { describe, expect, it } from "vitest";

import {
  describePreferences,
  NO_PREFERENCES,
  preferencesFromQuery,
  preferencesToQuery,
} from "#lib/deck-fields.ts";

// Preferences live only in the deck's URL, so the query is their storage
// format: it must round-trip, and a bad link must still open the deck.

const genres = new Map([
  [18, "Drama"],
  [35, "Comedy"],
]);

describe("preferences in the URL", () => {
  it("round-trips through the query, with genres sorted and deduplicated", () => {
    const query = new URLSearchParams(
      "maxRuntime=120&minYear=1990&maxYear=2009&genreIds=35&genreIds=18&genreIds=35"
    );
    const preferences = preferencesFromQuery(query);
    expect(preferences).toEqual({
      maxRuntime: 120,
      minYear: 1990,
      maxYear: 2009,
      genreIds: [18, 35],
    });
    expect(
      preferencesFromQuery(new URLSearchParams(preferencesToQuery(preferences)))
    ).toEqual(preferences);
  });

  it("reads an invalid query as no preferences", () => {
    for (const query of [
      "maxRuntime=abc",
      "minYear=2010&maxYear=1990",
      "genreIds=-1",
    ]) {
      expect(preferencesFromQuery(new URLSearchParams(query))).toEqual(
        NO_PREFERENCES
      );
    }
  });

  it("writes nothing for no preferences", () => {
    expect(preferencesToQuery(NO_PREFERENCES)).toBe("");
  });
});

describe("describePreferences", () => {
  it("says Anything when nothing is set", () => {
    expect(describePreferences(NO_PREFERENCES, genres)).toBe("Anything");
  });

  it("lists only the parts that are set", () => {
    expect(
      describePreferences({ ...NO_PREFERENCES, genreIds: [35] }, genres)
    ).toBe("Comedy");
    expect(
      describePreferences(
        { maxRuntime: 120, minYear: 1990, maxYear: 2009, genreIds: [18, 35] },
        genres
      )
    ).toBe("Drama, Comedy · Up to 2 h · 1990–2009");
    expect(
      describePreferences({ ...NO_PREFERENCES, minYear: 2000 }, genres)
    ).toBe("2000 or later");
  });
});
