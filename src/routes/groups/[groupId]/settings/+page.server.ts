import { z } from "zod";

import { groupNameSchema, nicknameSchema } from "#lib/group-fields.ts";
import { db } from "#lib/server/db/index.ts";
import { groupAction } from "#lib/server/group-forms.ts";
import {
  deleteGroup,
  leaveGroup,
  renameGroup,
  setNickname,
} from "#lib/server/groups.ts";

import type { Actions } from "./$types";

const actionId = z.uuid();

export const actions = {
  nickname: (event) =>
    groupAction(
      event,
      z.object({ actionId, nickname: nicknameSchema }),
      (input) => setNickname(db, input)
    ),
  rename: (event) =>
    groupAction(event, z.object({ actionId, name: groupNameSchema }), (input) =>
      renameGroup(db, input)
    ),
  leave: (event) =>
    groupAction(
      event,
      z.object({ actionId }),
      (input) => leaveGroup(db, input),
      {
        thenHome: true,
      }
    ),
  delete: (event) =>
    groupAction(
      event,
      z.object({ actionId }),
      (input) => deleteGroup(db, input),
      { thenHome: true }
    ),
} satisfies Actions;
