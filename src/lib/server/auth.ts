import { BETTER_AUTH_SECRET } from "$app/env/private";
import { getRequestEvent } from "$app/server";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";

import { db } from "#lib/server/db/index.ts";
import { sendSignInCode } from "#lib/server/email.ts";

// Created once per instance (module level), like the database pool. It holds
// configuration only; per-request data arrives through each call's headers.
export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  // Better Auth builds URLs and checks request origins from the request's host,
  // but only for hosts on this list. Explicit hosts, not "*.vercel.app": that
  // would also trust every other Vercel project.
  baseURL: {
    allowedHosts: [
      "localhost:5173", // vite dev
      "localhost:4173", // vite preview (e2e tests)
      "unseen-sooty-ten.vercel.app",
    ],
  },
  // `usePlural` maps Better Auth's models (user, session…) to our plural tables.
  database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
  rateLimit: {
    // In memory, every serverless instance would keep its own counts.
    storage: "database",
    customRules: {
      // Each send is an email. The default (3 per minute per IP) would allow
      // thousands a day; Resend's free tier is 100.
      "/email-otp/send-verification-otp": { window: 600, max: 3 },
    },
  },
  // Sign-in by code is the only method. Close the plugin's password and
  // email-change endpoints so they can't be used to attach other credentials.
  disabledPaths: [
    "/email-otp/request-password-reset",
    "/email-otp/reset-password",
    "/forget-password/email-otp",
    "/email-otp/request-email-change",
    "/email-otp/change-email",
  ],
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // Other types can only come from the endpoints disabled above.
        if (type !== "sign-in") return;
        await sendSignInCode(email, otp);
      },
    }),
    // Lets Better Auth set cookies when called from server code (e.g. a
    // refreshed session expiry during `getSession` in hooks.server.ts).
    // Must be the last plugin.
    sveltekitCookies(getRequestEvent),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
