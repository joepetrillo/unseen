import { BETTER_AUTH_SECRET } from "$app/env/private";
import { getRequestEvent } from "$app/server";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { z } from "zod";

import { db } from "#lib/server/db/index.ts";
import { sendSignInCode } from "#lib/server/email.ts";
import {
  consumeSignInCodeRequest,
  WINDOW_MINUTES,
} from "#lib/server/sign-in-code-limit.ts";

// The part of a send-code request our per-email limit needs. Normalized the
// way Better Auth does it (lowercase, then validate), so the limit counts
// exactly the address the code is sent to. Better Auth validates the rest.
const signInCodeRequestSchema = z.object({
  email: z
    .string()
    .transform((email) => email.toLowerCase())
    .pipe(z.email()),
  // Only sign-in codes are emailed (see `sendVerificationOTP` below).
  type: z.literal("sign-in"),
});

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
    // Per IP, and a room of people on one Wi-Fi shares an IP, so these leave
    // room for a group signing in together. The strict limit is per email
    // address (`hooks` below).
    customRules: {
      // Each send is an email; also caps how fast one IP can use up Resend's
      // free tier (100 a day).
      "/email-otp/send-verification-otp": { window: 600, max: 10 },
      // Default is 3 per 10 seconds. Guessing is already stopped by each
      // code's 3-attempt limit, so this only needs to stop hammering.
      "/sign-in/email-otp": { window: 60, max: 10 },
    },
  },
  hooks: {
    // Runs after the IP limit but before the endpoint, so a refused request
    // never replaces the pending code.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/email-otp/send-verification-otp") return;
      const body = signInCodeRequestSchema.safeParse(ctx.body);
      // Not a valid sign-in code request: nothing will be emailed, and the
      // endpoint's own validation rejects anything malformed.
      if (!body.success) return;
      if (!(await consumeSignInCodeRequest(db, body.data.email))) {
        throw new APIError("TOO_MANY_REQUESTS", {
          message: `Too many codes for this email. Try again in ${String(WINDOW_MINUTES)} minutes.`,
        });
      }
    }),
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
      // Asking again re-sends the pending code (with a fresh 5 minutes) instead
      // of replacing it, so whichever email arrives first has a working code.
      resendStrategy: "reuse",
      // Better Auth runs this without passing errors back: a failed send is
      // logged, and the request still reports success.
      async sendVerificationOTP({ email, otp, type }) {
        // Codes are only for signing in. The same endpoint also issues
        // email-verification and password-reset codes, which we never send.
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
