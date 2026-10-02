import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { testDatabaseUrl } from "./environment.ts";

vi.mock("node:fs", () => ({ existsSync: () => true, readFileSync: vi.fn() }));

const TEST_URL = "postgres://test:test@localhost:55432/disposable";
const APP_URL = "postgres://app:app@database.example/app";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("test database selection", () => {
  it("never falls back to DATABASE_URL", () => {
    vi.stubEnv("TEST_DATABASE_URL", undefined);
    vi.stubEnv("DATABASE_URL", APP_URL);
    vi.mocked(readFileSync).mockReturnValue(`DATABASE_URL=${APP_URL}`);

    expect(() => testDatabaseUrl()).toThrow(/TEST_DATABASE_URL/);
  });

  it("keeps an explicitly supplied test URL even when a local file exists", () => {
    vi.stubEnv("TEST_DATABASE_URL", TEST_URL);
    vi.mocked(readFileSync).mockReturnValue(`TEST_DATABASE_URL=${APP_URL}`);

    expect(testDatabaseUrl()).toBe(TEST_URL);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("reads only the test URL from the local file without changing process env", () => {
    vi.stubEnv("TEST_DATABASE_URL", undefined);
    vi.stubEnv("DATABASE_URL", APP_URL);
    vi.mocked(readFileSync).mockReturnValue(
      `TEST_DATABASE_URL=${TEST_URL}\nDATABASE_URL=postgres://wrong:wrong@localhost/wrong`
    );

    expect(testDatabaseUrl()).toBe(TEST_URL);
    expect(process.env.DATABASE_URL).toBe(APP_URL);
    expect(process.env.TEST_DATABASE_URL).toBeUndefined();
  });

  it.each(["", "https://example.com/db", "not a URL"])(
    "rejects an invalid test URL (%j)",
    (value) => {
      vi.stubEnv("TEST_DATABASE_URL", value);
      expect(() => testDatabaseUrl()).toThrow(/TEST_DATABASE_URL/);
    }
  );
});
