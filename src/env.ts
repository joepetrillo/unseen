import { defineEnvVars } from "@sveltejs/kit/env";
import { z } from "zod";

// Every environment variable the app uses is declared here. SvelteKit validates
// them when the app starts and when it builds, so a missing value fails loudly
// instead of causing confusing errors later. Server-only values are imported
// from `$app/env/private`; ones marked `public: true` from `$app/env/public`.
// Scripts (scripts/*.ts) run outside SvelteKit and validate their own.
export const variables = defineEnvVars({
  DATABASE_URL: {
    description: "Neon pooled connection string (hostname contains -pooler).",
    schema: z.url({
      protocol: /^postgres(ql)?$/,
      error: "DATABASE_URL must be a postgres:// URL. Run `vercel env pull`.",
    }),
  },
});
