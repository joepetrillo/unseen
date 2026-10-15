import type { LayoutServerLoad } from "./$types";

// Hands the signed-in user (set by hooks.server.ts) to every page as
// `data.user`. Only the fields pages need, since this data reaches the browser.
export const load: LayoutServerLoad = ({ locals }) => {
  const { user } = locals;
  return {
    user: user === null ? null : { id: user.id, email: user.email },
  };
};
