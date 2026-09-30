import { defineEnvVars } from "@sveltejs/kit/env";

// Every environment variable the app uses is declared here. SvelteKit validates
// them when the app starts, so a missing value fails loudly instead of causing
// confusing errors later. Server-only values are imported from
// `$app/env/private`; ones marked `public: true` from `$app/env/public`.
export const variables = defineEnvVars({
  DATABASE_URL: {
    description: "Neon Postgres connection string.",
    schema: (value) => {
      if (!value) {
        throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
      }
      return value;
    },
  },
});
