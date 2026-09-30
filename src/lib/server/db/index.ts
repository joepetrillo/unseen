import { DATABASE_URL } from "$app/env/private";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const client = neon(DATABASE_URL);

// Drizzle v1: relations (defined with `defineRelations`) get passed here once
// the real schema exists in stage 2.
export const db = drizzle({ client });
