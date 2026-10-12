import { error } from "@sveltejs/kit";
import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { requireUser } from "#lib/server/require-user.ts";
import { excludeSchema } from "#lib/server/watch-session-forms.ts";
import { pollWatchSession } from "#lib/server/watch-sessions.ts";
import type { PollReply } from "#lib/watch-fields.ts";

import type { RequestHandler } from "./$types";

const pollSchema = z.object({
  participationId: z.uuid(),
  since: z.string().max(64),
  exclude: excludeSchema,
});

// The deck's poll (#lib/watch-session-updates.ts). A GET: it only reads, so
// it never counts as activity. hooks.server.ts marks every response
// private and uncached.
export const GET: RequestHandler = async ({ params, url, locals }) => {
  const user = requireUser(locals);
  const watchSessionId = z.uuid().safeParse(params.watchSessionId);
  const query = pollSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!watchSessionId.success || !query.success) error(400, "Bad poll.");

  const reply: PollReply = await pollWatchSession(db, {
    ...query.data,
    userId: user.id,
    watchSessionId: watchSessionId.data,
  });
  return Response.json(reply);
};
