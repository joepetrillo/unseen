import { parseThemeChoice, THEME_COOKIE } from "#lib/theme.svelte.ts";

import type { LayoutServerLoad } from "./$types";

// Hands the signed-in user (set by hooks.server.ts) to every page as
// `data.user`. Only the fields pages need, since this data reaches the browser.
// The appearance pick comes along so the toggle renders showing it.
export const load: LayoutServerLoad = ({ locals, cookies }) => {
  const { user } = locals;
  return {
    user: user === null ? null : { id: user.id, email: user.email },
    themeChoice: parseThemeChoice(cookies.get(THEME_COOKIE)),
  };
};
