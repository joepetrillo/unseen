import { DATABASE_URL } from "$app/env/private";
import { attachDatabasePool } from "@vercel/functions";

import { createDb } from "./client.ts";

// Runs once per instance: Node caches modules, so every request on a warm
// Fluid compute instance shares this pool. Two connections is plenty because
// Neon's pooler (DATABASE_URL) multiplexes them onto real Postgres connections.
const { pool, db } = createDb(DATABASE_URL, 2);

// Closes idle connections before Vercel suspends the instance, so they don't leak.
attachDatabasePool(pool);

export { db };
