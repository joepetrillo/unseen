import { error } from "@sveltejs/kit";
import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { getGroupForMember } from "#lib/server/groups.ts";
import { requireUser } from "#lib/server/require-user.ts";

import type { LayoutServerLoad } from "./$types";

// Every page under /groups/<id> needs the group and the membership check, so
// it happens once here. Kit runs page loads alongside this one, so a page
// load that reads more group data first awaits `parent()`: it must not
// query anything until this check has passed. Form actions don't run layout
// loads at all; they rely on the server modules' own checks.
export const load: LayoutServerLoad = async ({ params, locals }) => {
  const user = requireUser(locals);
  const groupId = z.uuid().safeParse(params.groupId);
  const group = groupId.success
    ? await getGroupForMember(db, groupId.data, user.id)
    : null;
  // Same answer for "no such group" and "not your group", so a stranger
  // can't learn which IDs exist.
  if (group === null) error(404, "Group not found.");
  return { group };
};
