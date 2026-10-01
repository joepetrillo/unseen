import { z } from "zod";

import type { PageLoad } from "./$types";

// Only same-site paths: "/x" but not "//evil.com" or "/\evil.com", which
// browsers treat as other sites. Anything else falls back to the home page.
const redirectToSchema = z
  .string()
  .regex(/^\/(?![/\\])/)
  .catch("/");

// Universal load (no `.server`): runs on the server for the first visit and in
// the browser on client-side navigation. It only reads the URL, so either works.
export const load: PageLoad = ({ url }) => {
  return {
    redirectTo: redirectToSchema.parse(url.searchParams.get("redirectTo")),
  };
};
