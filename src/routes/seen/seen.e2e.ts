import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { actions, users } from "#lib/server/db/schema.ts";
import { connectTestDb, createFixtures } from "#lib/server/testing/db.ts";
import { deleteAccount, signIn } from "#lib/server/testing/sign-in.ts";

const { pool, db } = connectTestDb();
const fixtures = createFixtures(db);

const runId = `e2e-${crypto.randomUUID()}`;
// A title only this run's movie has, so searching for the run ID finds it alone.
const title = `Unseen test movie ${runId}`;
const emails: string[] = [];

test.beforeAll(async () => {
  await fixtures.movie({ title, releaseDate: "1999-03-31" });
});

test.afterAll(async () => {
  for (const email of emails) await deleteAccount(db, email);
  await fixtures.cleanUp();
  await pool.end();
});

// Each test signs in as a new user, so their seen lists start empty.
async function signInAsNewUser(page: Page): Promise<string> {
  const email = `${runId}-${String(emails.length)}@example.test`;
  emails.push(email);
  await signIn(page, db, email);
  return email;
}

async function searchAllMovies(page: Page): Promise<void> {
  await page.goto("/seen?scope=all");
  await page.getByRole("searchbox", { name: "Title" }).fill(runId);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(`/seen?scope=all&title=${runId}`);
}

test("adds a movie to the seen list and removes it", async ({ page }) => {
  await signInAsNewUser(page);
  await page.goto("/seen");
  await expect(page.getByText("Nothing here yet")).toBeVisible();

  await searchAllMovies(page);
  const row = page.getByRole("listitem").filter({ hasText: title });
  await row.getByRole("button", { name: `Seen it: ${title}` }).click();

  // Saved, and the search is still there.
  await expect(row.getByText("1999 · Seen")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Title" })).toHaveValue(
    runId
  );

  // Switching to your list keeps the search.
  await page.getByRole("link", { name: "Your list (1)" }).click();
  await expect(page).toHaveURL(`/seen?title=${runId}`);
  await row.getByRole("button", { name: `Remove ${title}` }).click();

  await expect(page.getByText("No movies match.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Your list (0)" })).toBeVisible();
});

test("a retry after a lost response doesn't save the change twice", async ({
  page,
}) => {
  const email = await signInAsNewUser(page);
  await searchAllMovies(page);

  // The first save reaches the server, but its response never reaches the
  // browser: the classic case where the browser can't know it worked.
  await page.route(
    (url) => url.searchParams.has("/add"),
    async (route) => {
      await route.fetch();
      await route.abort();
    },
    { times: 1 }
  );
  const row = page.getByRole("listitem").filter({ hasText: title });
  const seenIt = row.getByRole("button", { name: `Seen it: ${title}` });
  await seenIt.click();
  await expect(row.getByRole("alert")).toHaveText(/Couldn't save/);

  // Trying again resends the same action ID, which the server recognizes.
  await seenIt.click();
  await expect(row.getByText("1999 · Seen")).toBeVisible();

  const logged = await db
    .select({ type: actions.type, seenVersion: users.seenVersion })
    .from(actions)
    .innerJoin(users, eq(users.id, actions.userId))
    .where(eq(users.email, email));
  expect(logged).toEqual([{ type: "seen_list_add", seenVersion: 1 }]);
});
