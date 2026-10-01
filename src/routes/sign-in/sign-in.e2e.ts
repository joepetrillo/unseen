import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { expect, test } from "@playwright/test";
import { eq, like } from "drizzle-orm";
import { z } from "zod";

import { createDb } from "#lib/server/db/client.ts";
import { users, verifications } from "#lib/server/db/schema.ts";

// Playwright runs under Node, which doesn't load .env.local the way Vite and
// Bun do. These are the Development values, so the test uses the dev database.
if (existsSync(".env.local")) {
  Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));
}
const { DATABASE_URL } = z
  .object({ DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }) })
  .parse(process.env);
const { pool, db } = createDb(DATABASE_URL, 1);

// A fresh address per run, on a reserved domain that can't receive mail.
const email = `e2e-${crypto.randomUUID()}@example.test`;

// Locally there's no proxy setting the client IP, so every request would share
// one rate-limit bucket (3 codes per 10 minutes) across runs. A random IP per
// run gives this run its own bucket.
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `10.${String(Math.floor(Math.random() * 256))}.0.1`,
  },
});

test.afterAll(async () => {
  // Deleting the user cascades to its sessions. Codes aren't linked to users.
  await db.delete(users).where(eq(users.email, email));
  await db
    .delete(verifications)
    .where(like(verifications.identifier, `%${email}`));
  await pool.end();
});

/**
 * Reads the code the server just created. Coupled to Better Auth's storage
 * format (identifier "sign-in-otp-<email>", value "<code>:<attempts>", stored
 * in plain text by default): if a Better Auth upgrade breaks this, check there.
 */
async function readSignInCode(): Promise<string> {
  const row = await db.query.verifications.findFirst({
    where: { identifier: `sign-in-otp-${email}` },
  });
  const code = row?.value.split(":")[0];
  if (code === undefined || !/^\d{6}$/.test(code)) {
    throw new Error("No sign-in code stored for the test email.");
  }
  return code;
}

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/dev/movies");
  await expect(page).toHaveURL("/sign-in?redirectTo=%2Fdev%2Fmovies");
});

test("signs in with an emailed code and returns to the requested page", async ({
  page,
}) => {
  await page.goto("/dev/movies");

  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByText("We sent a 6-digit code")).toBeVisible();

  await page.getByLabel("Code").fill(await readSignInCode());
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/dev/movies");

  // Signing out ends the session: protected pages redirect again.
  await page.goto("/");
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/sign-in");
  await page.goto("/dev/movies");
  await expect(page).toHaveURL(/\/sign-in\?/);
});
