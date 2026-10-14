import { error } from "@sveltejs/kit";
import { z } from "zod";

import { type PollReply, preferencesFromQuery } from "#lib/deck-fields.ts";
import { db } from "#lib/server/db/index.ts";
import { excludeSchema } from "#lib/server/deck-forms.ts";
import { pollGroupDeck } from "#lib/server/group-deck.ts";
import { requireUser } from "#lib/server/require-user.ts";

import type { RequestHandler } from "./$types";

const pollSchema = z.object({
  since: z.string().max(64),
  exclude: excludeSchema,
});

// The deck's poll (#lib/deck-updates.ts). A GET: it only reads.
// hooks.server.ts marks every response private and uncached. The deck sends
// its preferences along, so the cards dealt match the page's.
export const GET: RequestHandler = async ({ params, url, locals }) => {
  const user = requireUser(locals);
  const groupId = z.uuid().safeParse(params.groupId);
  const query = pollSchema.safeParse({
    since: url.searchParams.get("since"),
    exclude: url.searchParams.get("exclude") ?? undefined,
  });
  if (!groupId.success || !query.success) error(400, "Bad poll.");

  const reply: PollReply = await pollGroupDeck(db, {
    ...query.data,
    groupId: groupId.data,
    userId: user.id,
    preferences: preferencesFromQuery(url.searchParams),
  });
  return Response.json(reply);
};
