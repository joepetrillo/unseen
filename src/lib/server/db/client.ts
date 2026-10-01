import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { relations } from "./relations.ts";
import { withVerifiedTls } from "./url.ts";

// Shared by the app (db/index.ts) and scripts, which can't import the app's
// `$app/env/private` because it only exists inside SvelteKit's build.
export function createDb(connectionString: string, maxConnections: number) {
  const pool = new Pool({
    connectionString: withVerifiedTls(connectionString),
    max: maxConnections,
  });
  return { pool, db: drizzle({ client: pool, relations }) };
}

export type Db = ReturnType<typeof createDb>["db"];

// What `db.transaction` passes to its callback.
export type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
