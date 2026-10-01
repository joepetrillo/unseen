import { expect, test } from "@playwright/test";

import { MAX_CODES_PER_EMAIL } from "#lib/server/sign-in-code-limit.ts";
import { connectTestDb } from "#lib/server/testing/db.ts";
import { deleteAccount, readSignInCode } from "#lib/server/testing/sign-in.ts";

const { pool, db } = connectTestDb();

// Fresh addresses per run, on a reserved domain that can't receive mail.
const runId = `e2e-${crypto.randomUUID()}`;
const email = `${runId}@example.test`;
const limitedEmail = `${runId}-limited@example.test`;

test.afterAll(async () => {
  await deleteAccount(db, email);
  await deleteAccount(db, limitedEmail);
  await pool.end();
});

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/seen");
  await expect(page).toHaveURL("/sign-in?redirectTo=%2Fseen");
});

test("signs in with an emailed code and returns to the requested page", async ({
  page,
}) => {
  await page.goto("/seen");

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByText("We sent a 6-digit code")).toBeVisible();

  const code = await readSignInCode(db, email);

  // Asking again re-sends the same code, so the first email still works.
  await page.getByRole("button", { name: "send it again" }).click();
  await expect(page.getByRole("status")).toHaveText(/Sent/);
  expect(await readSignInCode(db, email)).toBe(code);

  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/seen");

  // Signing out ends the session: protected pages redirect again.
  await page.goto("/");
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.goto("/seen");
  await expect(page).toHaveURL(/\/sign-in\?/);
});

test("refuses more codes for one email within the limit window", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(limitedEmail);
  const sendCode = page.getByRole("button", { name: "Email me a code" });

  for (let i = 0; i < MAX_CODES_PER_EMAIL; i++) {
    await sendCode.click();
    await expect(page.getByText("We sent a 6-digit code")).toBeVisible();
    // Goes back to the email step; the address stays filled in.
    await page.getByRole("button", { name: "Use a different email" }).click();
  }

  await sendCode.click();
  await expect(page.getByRole("alert")).toHaveText(/Too many attempts/);
});
