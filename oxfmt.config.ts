import { defineConfig } from "oxfmt";

// Based on Ultracite's oxfmt preset, trimmed to the options that differ from oxfmt's defaults.
export default defineConfig({
  ignorePatterns: ["bun.lock", "/static/"],
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
