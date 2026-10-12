import { randomInt } from "node:crypto";

import { type Browser, expect, type Page, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";

import {
  genres,
  groupMembers,
  groups,
  movieGenres,
} from "#lib/server/db/schema.ts";
import { connectTestDb, createFixtures } from "#lib/server/testing/db.ts";
import { deleteAccount, signIn } from "#lib/server/testing/sign-in.ts";
import { VOTE_COUNT_FLOOR } from "#lib/server/watch-sessions.ts";

// Two people on two browsers, answering the same session. Changes reach the
// other screen by polling, so cross-screen checks allow a few poll rounds.

const { pool, db } = connectTestDb();
const fixtures = createFixtures(db);

const runId = `e2e-${crypto.randomUUID()}`;
const emails: string[] = [];
const groupIds: string[] = [];
const LIVE = { timeout: 15_000 };

let genreName = "";
const movies: { id: number; title: string }[] = [];

test.beforeAll(async () => {
  const genreId = await fixtures.genre();
  const genre = await db.query.genres.findFirst({ where: { id: genreId } });
  genreName = genre?.name ?? "";
  for (const [i, votes] of [9000, 8000, 7000].entries()) {
    const title = `Group movie ${String(i + 1)} ${runId}`;
    const id = await fixtures.movie({
      title,
      voteCount: VOTE_COUNT_FLOOR + votes,
      releaseDate: "2001-05-01",
      usReleaseDate: "2001-05-01",
      runtime: 110,
    });
    await db.insert(movieGenres).values({ movieId: id, genreId });
    movies.push({ id, title });
  }
});

test.afterAll(async () => {
  if (groupIds.length > 0) {
    await db.delete(groups).where(inArray(groups.id, groupIds));
  }
  for (const email of emails) await deleteAccount(db, email);
  await fixtures.cleanUp();
  await db.delete(genres).where(eq(genres.name, genreName));
  await pool.end();
});

function title(i: number): string {
  return movies[i]?.title ?? "";
}

/** A signed-in browser of its own (own cookies, own client IP). */
async function person(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${String(randomInt(256))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`,
    },
  });
  const page = await context.newPage();
  const email = `${runId}-${String(emails.length)}@example.test`;
  emails.push(email);
  await signIn(page, db, email);
  return page;
}

/**
 * Alex creates a group, Sam is added to it, and Alex starts a session with
 * Sam ticked; Sam accepts from the group page. Both end up on the deck.
 */
async function startTogether(browser: Browser) {
  const alex = await person(browser);
  await alex.getByRole("link", { name: "New group" }).click();
  await alex.getByLabel("Group name").fill("Movie night");
  await alex.getByLabel("What should this group call you?").fill("Alex");
  await alex.getByRole("button", { name: "Create group" }).click();
  await expect(alex.getByRole("heading", { level: 1 })).toHaveText(
    "Movie night"
  );
  const groupId = new URL(alex.url()).pathname.split("/").at(-1) ?? "";
  groupIds.push(groupId);

  // Joining a group is stage 5's journey; here Sam is simply a member.
  const sam = await person(browser);
  const samUser = await db.query.users.findFirst({
    where: { email: emails.at(-1) ?? "" },
  });
  await db.insert(groupMembers).values({
    groupId,
    userId: samUser?.id ?? "",
    role: "member",
    nickname: "Sam",
  });

  await alex.getByRole("link", { name: "Find a movie" }).click();
  // Everyone in the group starts out ticked.
  await expect(alex.getByRole("checkbox", { name: "Sam" })).toBeChecked();
  await alex.getByText(genreName, { exact: true }).click();
  await alex.getByRole("button", { name: "Start" }).click();
  await expect(alex).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
  await expect(card(alex)).toHaveText(title(0));

  await sam.goto(`/groups/${groupId}`);
  await sam.getByRole("link", { name: "Join the session" }).click();
  await expect(sam.getByRole("heading", { level: 1 })).toHaveText(
    "Alex invited you"
  );
  await sam.getByRole("button", { name: "Join" }).click();
  await expect(card(sam)).toHaveText(title(0));
  return { alex, sam };
}

function card(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

function answer(page: Page, choice: "Seen" | "Not seen") {
  return page.getByRole("button", { name: choice, exact: true }).click();
}

test("two people see each other's answers and reach a shared match", async ({
  browser,
}) => {
  const { alex, sam } = await startTogether(browser);

  // Both say Not seen to the first movie: a match on both screens, Alex's
  // by polling.
  await answer(alex, "Not seen");
  await expect(alex.getByRole("link", { name: "Matches 0" })).toBeVisible();
  await answer(sam, "Not seen");
  await expect(sam.getByRole("link", { name: "Matches 1" })).toBeVisible();
  await expect(alex.getByRole("link", { name: "Matches 1" })).toBeVisible(LIVE);

  // Sam is looking at movie 2 when Alex says Seen to it: the card stays on
  // Sam's screen (it never moves under a tap), and it can't match.
  await expect(card(sam)).toHaveText(title(1));
  await answer(alex, "Seen");
  // Several poll rounds: the card is still there.
  await sam.waitForTimeout(6000);
  await expect(card(sam)).toHaveText(title(1));
  await answer(sam, "Not seen");
  await expect(card(sam)).toHaveText(title(2));
  await expect(sam.getByRole("link", { name: "Matches 1" })).toBeVisible();

  // Alex finishes first and waits on Sam, by name.
  await answer(alex, "Not seen");
  await expect(alex.getByText("You're caught up")).toBeVisible();
  await expect(alex.getByText("Waiting for Sam to answer.")).toBeVisible();

  // Sam's Not seen makes the second match; Alex's screen moves on to "used
  // up" by itself.
  await answer(sam, "Not seen");
  await expect(
    alex.getByText("That's every movie that fits these filters.")
  ).toBeVisible(LIVE);
  await expect(alex.getByRole("link", { name: "Matches 2" })).toBeVisible();
  await expect(sam.getByRole("link", { name: "Matches 2" })).toBeVisible();
});

test("doesn't poll while an answer is being saved", async ({ browser }) => {
  const { alex } = await startTogether(browser);

  // Hold Alex's next save until the test lets it through; count polls.
  const gate = Promise.withResolvers<undefined>();
  await alex.route(/\?\/answer$/, async (route) => {
    await gate.promise;
    await route.continue();
  });
  let polls = 0;
  alex.on("request", (request) => {
    if (request.url().includes("/poll?")) polls += 1;
  });

  await answer(alex, "Not seen");
  await expect(alex.getByText("Saving…")).toBeVisible();
  // Several poll intervals pass with the save out: no polls.
  await alex.waitForTimeout(6000);
  expect(polls).toBe(0);

  // Once it's answered, polling resumes.
  gate.resolve(undefined);
  await expect(alex.getByText("Saving…")).toBeHidden();
  await expect.poll(() => polls, LIVE).toBeGreaterThan(0);
});

test("the host's Change filters keeps the session and its matches", async ({
  browser,
}) => {
  const { alex, sam } = await startTogether(browser);
  const sessionUrl = alex.url();
  await answer(alex, "Not seen");
  await answer(sam, "Not seen");
  await expect(alex.getByRole("link", { name: "Matches 1" })).toBeVisible(LIVE);
  await expect(card(sam)).toHaveText(title(1));

  // Guests can't change filters; the host can, in place.
  await expect(sam.getByRole("link", { name: "Change filters" })).toHaveCount(
    0
  );
  await alex.getByRole("link", { name: "Change filters" }).click();
  await expect(alex.getByRole("heading", { level: 1 })).toHaveText(
    "Change filters"
  );
  // The test movies are from 2001: nothing fits from 2002 on.
  await alex.getByLabel("From year").fill("2002");
  await alex.getByRole("button", { name: "Save filters" }).click();
  await expect(alex).toHaveURL(sessionUrl);
  await expect(
    alex.getByText("That's every movie that fits these filters.")
  ).toBeVisible();
  await expect(alex.getByRole("link", { name: "Matches 1" })).toBeVisible();

  // Sam stays in the same session: the card on screen stays, the filters
  // shown update, and the match is still there.
  await expect(sam.getByText("2002 or later")).toBeVisible(LIVE);
  await expect(card(sam)).toHaveText(title(1));
  await answer(sam, "Not seen");
  await expect(
    sam.getByText("That's every movie that fits these filters.")
  ).toBeVisible();
  await expect(sam).toHaveURL(sessionUrl);
  await expect(sam.getByRole("link", { name: "Matches 1" })).toBeVisible();
});

test("signing out elsewhere takes the deck to sign-in", async ({ browser }) => {
  const { sam } = await startTogether(browser);

  // The login session ends (expired, or signed out on another tab): the
  // next poll is redirected, and the page follows it to sign-in.
  await sam.context().clearCookies();
  await expect(sam).toHaveURL(/\/sign-in/, LIVE);
});
