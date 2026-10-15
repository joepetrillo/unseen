import { findInvite } from "#lib/server/group-forms.ts";

import type { Actions } from "./$types";

export const actions = { find: findInvite } satisfies Actions;
