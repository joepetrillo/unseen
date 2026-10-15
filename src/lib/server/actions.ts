import { eq } from "drizzle-orm";

import type { Db, Transaction } from "#lib/server/db/client.ts";
import { type ActionType, actions } from "#lib/server/db/schema.ts";

// What each type of action carries besides its ID and user. Every action type
// needs an entry (`Action` below indexes this by type), so a new enum value
// fails to compile until its inputs are named here.
interface InputsByType {
  seen_list_add: { movieId: number };
  seen_list_remove: { movieId: number };
  group_create: { groupId: string; groupName: string; nickname: string };
  group_join: { groupId: string; nickname: string };
  group_leave: { groupId: string };
  group_rename: { groupId: string; groupName: string };
  group_delete: { groupId: string };
  group_reset_invite: { groupId: string };
  group_remove_member: { groupId: string; memberId: string };
  group_set_nickname: { groupId: string; nickname: string };
  // The group deck (stage 8). An answer is about the person, but it carries
  // the group whose deck it came from: that's the undo stack it joins.
  answer_seen: { groupId: string; movieId: number };
  answer_not_seen: { groupId: string; movieId: number };
  answer_undo: { groupId: string };
  group_mark_watched: { groupId: string; movieId: number };
  group_unmark_watched: { groupId: string; movieId: number };
}

/**
 * A change a user asked for, under the ID their browser generated for it.
 * A union with one member per type: `{ type: "group_rename", ... }` must
 * carry exactly the inputs a rename needs, checked by the compiler.
 */
export type Action = {
  [T in ActionType]: { id: string; userId: string; type: T } & InputsByType[T];
}[ActionType];

type LoggedAction = typeof actions.$inferSelect;

// Every input column. A retry must match all of them: the same ID with a
// different nickname, say, is a different action.
const inputs = [
  "movieId",
  "groupId",
  "memberId",
  "groupName",
  "nickname",
] as const satisfies readonly (keyof LoggedAction)[];

/**
 * - `applied`: the change was made.
 * - `duplicate`: this exact action already succeeded (a retry); nothing changed.
 * - `conflict`: the ID belongs to a different action; nothing changed.
 */
export type ActionOutcome = "applied" | "duplicate" | "conflict";

interface RunOptions {
  /**
   * Runs only when the action ID isn't in the log yet, before the change's
   * transaction and outside it, so what it does sticks even if the change is
   * refused and rolled back. For charging a limit (invite lookups): a retry
   * of an action that already went through isn't charged again. Throw to
   * stop before the change runs.
   */
  beforeNew?: () => Promise<void>;
}

/**
 * Makes a change at most once per action ID. The action is logged and `apply`
 * runs in the same transaction, so either both happen or neither does: a
 * failed change leaves no log entry, and its retry runs normally.
 */
export async function runAction(
  db: Db,
  action: Action,
  apply: (tx: Transaction) => Promise<void>,
  { beforeNew }: RunOptions = {}
): Promise<ActionOutcome> {
  if (beforeNew !== undefined) {
    const logged = await db.query.actions.findFirst({
      columns: { id: true },
      where: { id: action.id },
    });
    if (logged === undefined) await beforeNew();
  }

  return db.transaction(async (tx) => {
    // If a request with the same ID is still in flight (a double submit), this
    // waits until its transaction ends, then sees its row. So a double submit
    // is applied once, never twice.
    const [logged] = await tx
      .insert(actions)
      .values(action)
      .onConflictDoNothing({ target: actions.id })
      .returning({ id: actions.id });

    if (logged === undefined) {
      const existing = await tx.query.actions.findFirst({
        where: { id: action.id },
      });
      return existing !== undefined && isSameAction(existing, action)
        ? "duplicate"
        : "conflict";
    }

    await apply(tx);
    return "applied";
  });
}

/**
 * Marks an answer as reversed by the undo `undoneBy`, taking it off its
 * owner's undo stack for good. Part of the undo's transaction.
 */
export async function markUndone(
  tx: Transaction,
  actionId: string,
  undoneBy: string
): Promise<void> {
  await tx
    .update(actions)
    .set({ undoneByActionId: undoneBy })
    .where(eq(actions.id, actionId));
}

// Includes the user: an ID taken from someone else's request is a conflict,
// never a successful retry.
function isSameAction(logged: LoggedAction, action: Action): boolean {
  // Each union member has only its own inputs; read the rest as missing.
  const given: Partial<Record<(typeof inputs)[number], unknown>> = action;
  return (
    logged.userId === action.userId &&
    logged.type === action.type &&
    inputs.every((input) => sameValue(logged[input], given[input] ?? null))
  );
}

// Arrays (genre and user IDs) compare by content; everything else is a plain value.
function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }
  return a === b;
}
