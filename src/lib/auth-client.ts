import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

// Browser-side calls to Better Auth's endpoints (/api/auth/*). Sign-in and
// sign-out go through here instead of form actions: Better Auth applies its
// rate limits and origin checks only to requests that reach those endpoints.
// The plain client, not `better-auth/svelte`: that one only adds a client-side
// session store, and the signed-in user comes from the server (`data.user`).
// No baseURL: it defaults to the page's own origin.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
