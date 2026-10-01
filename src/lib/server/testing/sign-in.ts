import { expect, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import type { Db } from "#lib/server/db/client.ts";
import {
  signInCodeLimits,
  users,
  verifications,
} from "#lib/server/db/schema.ts";

// Sign-in helpers for end-to-end tests. Locally codes aren't emailed, so tests
// read them from the database.

/**
 * Reads the code the server just created for `email`. Coupled to Better
 * Auth's storage format (identifier "sign-in-otp-<email>", value
 * "<code>:<attempts>", stored in plain text by default): if a Better Auth
 * upgrade breaks this, check there.
 */
export async function readSignInCode(db: Db, email: string): Promise<string> {
  const row = await db.query.verifications.findFirst({
    where: { identifier: `sign-in-otp-${email}` },
  });
  const code = row?.value.split(":")[0];
  if (code === undefined || !/^\d{6}$/.test(code)) {
    throw new Error(`No sign-in code stored for ${email}.`);
  }
  return code;
}

/** Signs in through the sign-in page, creating the account if it's new. */
export async function signIn(page: Page, db: Db, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByText("We sent a 6-digit code")).toBeVisible();
  await page.getByLabel("Code").fill(await readSignInCode(db, email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Deletes what signing in with `email` left behind. Deleting the user cascades
 * to their sessions and data; codes and limits aren't linked to users.
 */
export async function deleteAccount(db: Db, email: string): Promise<void> {
  await db.delete(users).where(eq(users.email, email));
  await db
    .delete(verifications)
    .where(eq(verifications.identifier, `sign-in-otp-${email}`));
  await db.delete(signInCodeLimits).where(eq(signInCodeLimits.email, email));
}
