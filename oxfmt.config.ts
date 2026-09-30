import { defineConfig } from "oxfmt";

// Based on Ultracite's oxfmt preset, trimmed to the options that differ from oxfmt's defaults.
export default defineConfig({
  // drizzle/ holds generated migrations and snapshots; drizzle-kit owns their format.
  ignorePatterns: [
    "bun.lock",
    "/static/",
    "/.agents/**",
    "/.claude/**",
    "/drizzle/**",
  ],
  printWidth: 80,
  proseWrap: "never",
  sortImports: true,
  sortTailwindcss: {
    stylesheet: "./src/routes/layout.css",
    functions: ["clsx", "cva", "tw", "twMerge", "cn", "twJoin", "tv"],
  },
  svelte: true,
  trailingComma: "es5",
});
