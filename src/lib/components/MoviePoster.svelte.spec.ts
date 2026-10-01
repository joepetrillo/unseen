import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";

import MoviePoster from "./MoviePoster.svelte";

describe("MoviePoster", () => {
  it("loads the poster from TMDB's image CDN in several widths", async () => {
    await render(MoviePoster, {
      posterPath: "/abc.jpg",
      title: "Inception",
      sizes: "48px",
    });

    const poster = page.getByRole("img", { name: "Poster for Inception" });
    await expect
      .element(poster)
      .toHaveAttribute("src", "https://image.tmdb.org/t/p/w342/abc.jpg");
    await expect
      .element(poster)
      .toHaveAttribute(
        "srcset",
        expect.stringContaining("https://image.tmdb.org/t/p/w92/abc.jpg 92w")
      );
    await expect.element(poster).toHaveAttribute("sizes", "48px");
  });

  it("shows a placeholder when the movie has no poster", async () => {
    await render(MoviePoster, {
      posterPath: null,
      title: "Obscure Film",
      sizes: "48px",
    });

    await expect
      .element(page.getByRole("img", { name: "No poster for Obscure Film" }))
      .toHaveTextContent("No poster");
  });
});
