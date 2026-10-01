import { error } from "@sveltejs/kit";

/**
 * The signed-in user, for pages and actions that need their ID. hooks.server.ts
 * already sends signed-out requests to the sign-in page before any load or
 * action runs, so this narrows the type rather than guarding anything new.
 */
export function requireUser(
  locals: App.Locals
): NonNullable<App.Locals["user"]> {
  if (locals.user === null) error(401, "Sign in to continue.");
  return locals.user;
}
