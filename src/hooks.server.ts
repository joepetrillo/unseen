import { building } from "$app/env";
import { redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit/hooks";
import { isAuthPath, svelteKitHandler } from "better-auth/svelte-kit";

import { auth } from "#lib/server/auth.ts";

const SIGN_IN_PATH = "/sign-in";

// Runs for every server request: pages, form actions, endpoints, and the data
// requests behind client-side navigation. Guarding here (not in a layout's
// `load`) also covers form actions and +server.ts endpoints, which layout
// loads never run for.
export const handle: Handle = async ({ event, resolve }) => {
  // Better Auth's own endpoints (/api/auth/*) answer directly. Skipping the
  // session lookup there saves a query on every sign-in request.
  if (building || isAuthPath(event.url.toString(), auth.options)) {
    return svelteKitHandler({ event, resolve, auth, building });
  }

  // `locals` is per request, so concurrent requests on one instance never see
  // each other's user. Reads the session cookie and looks the session up.
  const result = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = result?.user ?? null;
  event.locals.session = result?.session ?? null;

  // The sign-in page is the only page open to signed-out visitors. Afterwards
  // they return to the page they asked for.
  const onSignIn = event.url.pathname === SIGN_IN_PATH;
  if (event.locals.user === null && !onSignIn) {
    const redirectTo = event.url.pathname + event.url.search;
    const query = new URLSearchParams({ redirectTo }).toString();
    redirect(303, `${SIGN_IN_PATH}?${query}`);
  }
  if (event.locals.user !== null && onSignIn) {
    redirect(303, "/");
  }

  return resolve(event);
};
