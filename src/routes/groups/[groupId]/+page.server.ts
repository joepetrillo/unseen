import { error, fail, redirect } from "@sveltejs/kit";
import { z } from "zod";

import { preferencesFromQuery } from "#lib/deck-fields.ts";
import { groupNameSchema, nicknameSchema } from "#lib/group-fields.ts";
import { db } from "#lib/server/db/index.ts";
import { deckRefusal, movieIdSchema } from "#lib/server/deck-forms.ts";
import {
  answerMovie,
  type DeckOutcome,
  listMatches,
  listWaitingOn,
  listWatched,
  markWatched,
  unmarkWatched,
} from "#lib/server/group-deck.ts";
import { readForm, refusal, refusalMessage } from "#lib/server/group-forms.ts";
import {
  deleteGroup,
  getGroupForMember,
  type GroupOutcome,
  leaveGroup,
  removeMember,
  renameGroup,
  resetInvite,
  setNickname,
} from "#lib/server/groups.ts";
import { requireUser } from "#lib/server/require-user.ts";

import type { Actions, PageServerLoad, RequestEvent } from "./$types";

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const user = requireUser(locals);
  const groupId = z.uuid().safeParse(params.groupId);
  const group = groupId.success
    ? await getGroupForMember(db, groupId.data, user.id)
    : null;
  // Same answer for "no such group" and "not your group", so a stranger
  // can't learn which IDs exist.
  if (group === null) error(404, "Group not found.");
  const [matches, waitingOn, watched] = await Promise.all([
    // Coming from the deck, the URL carries tonight's preferences: the
    // matches that fit them come first.
    listMatches(db, group.id, preferencesFromQuery(url.searchParams)),
    listWaitingOn(db, group.id),
    listWatched(db, group.id),
  ]);
  return {
    group,
    inviteUrl: `${url.origin}/join/${group.inviteCode}`,
    matches,
    waitingOn,
    watched,
  };
};

// Better Auth's user IDs are random letters and digits.
const memberIdSchema = z.string().regex(/^[\w-]{1,64}$/);

/**
 * Runs one of this page's changes: reads the form, then applies `change` to
 * the group in the URL as the signed-in user. Leaving or deleting ends on
 * the home page; everything else reloads this one.
 */
async function groupAction<T extends z.ZodObject>(
  { request, locals, params }: RequestEvent,
  schema: T,
  change: (
    input: z.output<T> & { userId: string; groupId: string }
  ) => Promise<GroupOutcome>,
  { thenHome = false } = {}
) {
  const user = requireUser(locals);
  const groupId = z.uuid().safeParse(params.groupId);
  if (!groupId.success) {
    return fail(404, { message: refusalMessage("not_found") });
  }
  const form = await readForm(request, schema);
  if (!form.ok) return form.failure;

  const failed = refusal(
    await change({ ...form.data, userId: user.id, groupId: groupId.data })
  );
  if (failed !== null) return failed;
  if (thenHome) redirect(303, "/");
}

const actionId = z.uuid();

const movieSchema = z.object({ actionId, movieId: movieIdSchema });

/** Like groupAction, for the group deck's changes on this page. */
async function deckAction(
  { request, locals, params }: RequestEvent,
  change: (input: {
    actionId: string;
    movieId: number;
    userId: string;
    groupId: string;
  }) => Promise<DeckOutcome>
) {
  const user = requireUser(locals);
  const groupId = z.uuid().safeParse(params.groupId);
  if (!groupId.success) {
    return fail(404, { message: refusalMessage("not_found") });
  }
  const form = await readForm(request, movieSchema);
  if (!form.ok) return form.failure;
  return (
    deckRefusal(
      await change({ ...form.data, userId: user.id, groupId: groupId.data })
    ) ?? undefined
  );
}

export const actions = {
  rename: (event) =>
    groupAction(event, z.object({ actionId, name: groupNameSchema }), (input) =>
      renameGroup(db, input)
    ),
  nickname: (event) =>
    groupAction(
      event,
      z.object({ actionId, nickname: nicknameSchema }),
      (input) => setNickname(db, input)
    ),
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
  watched: (event) => deckAction(event, (input) => markWatched(db, input)),
  unwatched: (event) => deckAction(event, (input) => unmarkWatched(db, input)),
  // "Actually, I've seen this": a Seen answer that replaces your Not seen,
  // on your undo stack like any other answer.
  seen: (event) =>
    deckAction(event, (input) => answerMovie(db, { ...input, answer: "seen" })),
} satisfies Actions;
