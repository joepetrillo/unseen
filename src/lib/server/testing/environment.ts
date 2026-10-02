import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { z } from "zod";

// Only used by a browser server connected to the explicitly selected test DB.
export const TEST_AUTH_SECRET =
  "unseen-disposable-test-secret-at-least-32-characters";

/** Selects a disposable database without falling back to app credentials. */
export function testDatabaseUrl(): string {
  const value =
    process.env.TEST_DATABASE_URL ??
    (existsSync(".env.local")
      ? parseEnv(readFileSync(".env.local", "utf8")).TEST_DATABASE_URL
      : undefined);

  return z
    .url({
      protocol: /^postgres(ql)?$/,
      error:
        "Set TEST_DATABASE_URL to an explicitly disposable PostgreSQL database before running tests.",
    })
    .parse(value);
}
