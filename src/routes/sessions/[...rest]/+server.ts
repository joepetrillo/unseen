import { redirect } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

// Watch sessions were replaced by the group deck (stage 8). Old links from
// stages 6–7 land on the home page, where your groups are.
export const GET: RequestHandler = () => redirect(307, "/");
