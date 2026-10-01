import { describe, expect, it } from "vitest";

import { withVerifiedTls } from "./url.ts";

describe("withVerifiedTls", () => {
  it("upgrades Neon's sslmode=require to verify-full", () => {
    const url = withVerifiedTls(
      "postgresql://user:pw@ep-x-pooler.neon.tech/db?sslmode=require&channel_binding=require"
    );
    expect(new URL(url).searchParams.get("sslmode")).toBe("verify-full");
    expect(new URL(url).searchParams.get("channel_binding")).toBe("require");
  });

  it("leaves a URL without TLS settings alone", () => {
    const url = "postgres://ci:ci@localhost:5432/ci";
    expect(withVerifiedTls(url)).toBe(url);
  });
});
