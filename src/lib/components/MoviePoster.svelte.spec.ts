import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import MoviePoster from "./MoviePoster.svelte";

describe("MoviePoster", () => {
  it("loads the poster from TMDB's image CDN", async () => {
    await render(MoviePoster, { posterPath: "/abc.jpg", title: "Inception" });

    await expect
      .element(page.getByRole("img", { name: "Poster for Inception" }))
      .toHaveAttribute("src", "https://image.tmdb.org/t/p/w342/abc.jpg");
  });

  it("shows a placeholder when the movie has no poster", async () => {
    await render(MoviePoster, { posterPath: null, title: "Obscure Film" });

    await expect
      .element(page.getByRole("img", { name: "No poster for Obscure Film" }))
      .toHaveTextContent("No poster");
  });
});
