import { describe, expect, it } from "vitest";

import { pathAfterSignIn, signInPath } from "./sign-in-redirect.ts";

const ORIGIN = "https://unseen.test";

describe("signInPath", () => {
  it("remembers the requested page, including its query", () => {
    expect(signInPath(new URL(`${ORIGIN}/dev/movies?page=2`))).toBe(
      "/sign-in?redirectTo=%2Fdev%2Fmovies%3Fpage%3D2"
    );
  });

  it("leaves out the home page", () => {
    expect(signInPath(new URL(`${ORIGIN}/`))).toBe("/sign-in");
  });
});

describe("pathAfterSignIn", () => {
  function after(redirectTo: string | null): string {
    const url = new URL(`${ORIGIN}/sign-in`);
    if (redirectTo !== null) url.searchParams.set("redirectTo", redirectTo);
    return pathAfterSignIn(url);
  }

  it("returns to the requested page", () => {
    expect(after("/dev/movies?page=2")).toBe("/dev/movies?page=2");
  });

  it("goes home without a redirectTo", () => {
    expect(after(null)).toBe("/");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    // Browsers strip tabs and newlines from URLs, leaving "//evil.com".
    "/\t/evil.com",
    "https://evil.com/dev/movies",
    "javascript:alert(1)",
  ])("refuses to leave the site (%j)", (redirectTo) => {
    expect(after(redirectTo)).toBe("/");
  });

  it("never returns to the sign-in page", () => {
    expect(after("/sign-in?redirectTo=%2Fsign-in")).toBe("/");
  });
});
