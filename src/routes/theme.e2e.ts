import { randomInt } from "node:crypto";

import { expect, test } from "@playwright/test";

import { connectTestDb } from "#lib/server/testing/db.ts";
import { deleteAccount, signIn } from "#lib/server/testing/sign-in.ts";

const { pool, db } = connectTestDb();
const email = `e2e-theme-${crypto.randomUUID()}@example.test`;

test.beforeEach(async ({ page }) => {
  // Sign-in limits count per address; each run looks like a new one.
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${String(randomInt(256))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`,
  });
});

test.afterAll(async () => {
  await deleteAccount(db, email);
  await pool.end();
});

test("the appearance pick follows the device, sticks, and paints first", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page, db, email);
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
  await expect(page.getByText("Same as this device")).toBeVisible();

  // On System, the page switches when the device does.
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveClass(/dark/);

  // A pick overrides the device.
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveClass(/dark/);

  // It's there before the app's code runs: with every app script blocked,
  // only the one in app.html can set it, and the server drew the toggle
  // already showing it. No flash of the wrong theme or the wrong pick.
  await page.emulateMedia({ colorScheme: "light" });
  let blocked = 0;
  await page.route("**/_app/immutable/**/*.js", (route) => {
    blocked += 1;
    return route.abort();
  });
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await expect(page.getByText("Always dark")).toBeVisible();
  expect(blocked).toBeGreaterThan(0);
  await page.unrouteAll();

  // And the toggle remembers it after a normal reload.
  await page.reload();
  await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute(
    "aria-checked",
    "true"
  );
  await expect(page.getByText("Always dark")).toBeVisible();

  // A pick in another tab reaches this one.
  const other = await page.context().newPage();
  await other.goto("/");
  await other.getByRole("radio", { name: "System" }).click();
  await expect(html).not.toHaveClass(/dark/);
  await expect(page.getByText("Same as this device")).toBeVisible();
});
