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
  BETTER_AUTH_SECRET: {
    description:
      "Signs session cookies. Different per Vercel environment; generate with `openssl rand -base64 32`.",
    schema: z.string().min(32, {
      error: "BETTER_AUTH_SECRET must be at least 32 characters.",
    }),
  },
  RESEND_API_KEY: {
    description:
      "Sends sign-in codes. Production only; without it codes are printed to the terminal.",
    schema: z.string().startsWith("re_").optional(),
  },
  VERCEL_ENV: {
    description:
      "Set by Vercel (production, preview, development). Unset outside Vercel.",
    schema: z.enum(["production", "preview", "development"]).optional(),
  },
});
