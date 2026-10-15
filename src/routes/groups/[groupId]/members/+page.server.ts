import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { groupAction } from "#lib/server/group-forms.ts";
import { removeMember, resetInvite } from "#lib/server/groups.ts";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ parent, url }) => {
  const { group } = await parent();
  return { inviteUrl: `${url.origin}/join/${group.inviteCode}` };
};

const actionId = z.uuid();
// Better Auth's user IDs are random letters and digits.
const memberIdSchema = z.string().regex(/^[\w-]{1,64}$/);

export const actions = {
  // Also the invite card's reset on the group page (InviteCard.svelte).
  resetInvite: (event) =>
    groupAction(event, z.object({ actionId }), (input) =>
      resetInvite(db, input)
    ),
  removeMember: (event) =>
    groupAction(
      event,
      z.object({ actionId, memberId: memberIdSchema }),
      (input) => removeMember(db, input)
    ),
} satisfies Actions;
