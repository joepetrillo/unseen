import { RESEND_API_KEY, VERCEL_ENV } from "$app/env/private";
import { Resend } from "resend";

// Resend's shared sender. Until we verify our own domain (stage 10), it only
// delivers to the Resend account owner's address.
const FROM = "Unseen <onboarding@resend.dev>";

// Created once per instance, like the database pool. Undefined locally, where
// codes go to the terminal instead.
const resend =
  RESEND_API_KEY === undefined ? undefined : new Resend(RESEND_API_KEY);

export async function sendSignInCode(to: string, code: string): Promise<void> {
  if (resend === undefined) {
    // Never fall back to logging in production: anyone who can read the logs
    // could sign in as anyone.
    if (VERCEL_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set in production.");
    }
    console.info(`[email] Sign-in code for ${to}: ${code}`);
    return;
  }

  // Resend reports failures in `error` instead of throwing.
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `${code} is your Unseen sign-in code`,
    text: `Your Unseen sign-in code is ${code}. It expires in 5 minutes.\n\nIf you didn't try to sign in, you can ignore this email.`,
  });
  if (error !== null) {
    throw new Error(`Resend failed to send the sign-in code: ${error.message}`);
  }
}
