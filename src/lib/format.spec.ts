import { describe, expect, it } from "vitest";

import {
  formatCount,
  joinDetails,
  listNames,
  NO_BREAK_SPACE,
} from "#lib/format.ts";

describe("formatCount", () => {
  it("separates thousands", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1284)).toBe("1,284");
  });
});

describe("listNames", () => {
  it("names everyone in a short list", () => {
    expect(listNames(["Sam"])).toBe("Sam");
    expect(listNames(["Sam", "Alex"])).toBe("Sam and Alex");
    expect(listNames(["Sam", "Alex", "Jo"])).toBe("Sam, Alex, and Jo");
  });

  it("counts the rest of a long one", () => {
    expect(listNames(["Sam", "Alex", "Jo", "Mia"])).toBe(
      "Sam, Alex, Jo, and 1 other"
    );
    const hundred = Array.from(
      { length: 100 },
      (_, i) => `Member ${String(i)}`
    );
    expect(listNames(hundred, 2)).toBe("Member 0, Member 1, and 98 others");
  });
});

describe("joinDetails", () => {
  it("skips missing parts and keeps each dot off the start of a line", () => {
    expect(joinDetails(["1999", null, "Drama"])).toBe(
      `1999${NO_BREAK_SPACE}· Drama`
    );
    expect(joinDetails([null])).toBe("");
  });
});
