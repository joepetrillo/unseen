import { randomInt } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";
import { and, eq, inArray } from "drizzle-orm";

import {
  actions,
  genres,
  groupMembers,
  groupPastMatches,
  groups,
  movieGenres,
  seenMovies,
  users,
} from "#lib/server/db/schema.ts";
import { connectTestDb, createFixtures } from "#lib/server/testing/db.ts";
import { deleteAccount, signIn } from "#lib/server/testing/sign-in.ts";
import {
  startWatchSession,
  VOTE_COUNT_FLOOR,
} from "#lib/server/watch-sessions.ts";
import { NO_FILTERS } from "#lib/watch-fields.ts";

const { pool, db } = connectTestDb();
const fixtures = createFixtures(db);

const runId = `e2e-${crypto.randomUUID()}`;
const emails: string[] = [];
const groupIds: string[] = [];

// Three movies in a genre only this run uses: sessions filter on it, so the
// deck holds exactly these, most-voted first.
let genreName = "";
const movies: { id: number; title: string }[] = [];

test.beforeAll(async () => {
  const genreId = await fixtures.genre();
  const genre = await db.query.genres.findFirst({ where: { id: genreId } });
  genreName = genre?.name ?? "";
  for (const [i, votes] of [9000, 8000, 7000].entries()) {
    const title = `Deck movie ${String(i + 1)} ${runId}`;
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
  // Groups first: their sessions and past matches point at the movies.
  if (groupIds.length > 0) {
    await db.delete(groups).where(inArray(groups.id, groupIds));
  }
  for (const email of emails) await deleteAccount(db, email);
  await fixtures.cleanUp();
  await db.delete(genres).where(eq(genres.name, genreName));
  await pool.end();
});

test.beforeEach(async ({ page }) => {
  // Each test signs in from its own address, so the per-IP code limit holds.
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `10.${String(randomInt(256))}.${String(randomInt(256))}.${String(randomInt(1, 255))}`,
  });
});

async function signInWithGroup(page: Page): Promise<{ email: string }> {
  const email = `${runId}-${String(emails.length)}@example.test`;
  emails.push(email);
  await signIn(page, db, email);

  await page.getByRole("link", { name: "New group" }).click();
  await page.getByLabel("Group name").fill("Solo night");
  await page.getByLabel("What should this group call you?").fill("Me");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Solo night"
  );
  groupIds.push(new URL(page.url()).pathname.split("/").at(-1) ?? "");
  return { email };
}

async function startSession(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Find a movie" }).click();
  await page.getByText(genreName, { exact: true }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
}

function cardTitle(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

function title(i: number): string {
  return movies[i]?.title ?? "";
}

test("finds unseen movies alone, start to finish", async ({ page }) => {
  const { email } = await signInWithGroup(page);
  await startSession(page);

  // Most-voted first. Seen moves on; so does Not seen; Undo brings it back.
  await expect(cardTitle(page)).toHaveText(title(0));
  await page.getByRole("button", { name: "Seen", exact: true }).click();
  await expect(cardTitle(page)).toHaveText(title(1));
  await page.getByRole("button", { name: "Not seen" }).click();
  await expect(cardTitle(page)).toHaveText(title(2));
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(cardTitle(page)).toHaveText(title(1));
  await page.getByRole("button", { name: "Not seen" }).click();
  await page.getByRole("button", { name: "Not seen" }).click();
  await expect(
    page.getByText("That's every movie that fits these filters.")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Matches 2" })).toBeVisible();

  // The shortlist: where to watch, and a correction.
  await page.getByRole("link", { name: "Matches 2" }).click();
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(
    rows.first().getByRole("link", { name: "Where to watch" })
  ).toHaveAttribute(
    "href",
    `https://www.themoviedb.org/movie/${String(movies[1]?.id)}/watch?locale=US`
  );
  await page
    .getByRole("button", { name: `Actually, I've seen ${title(1)}` })
    .click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(title(2));

  // Back to the deck, then end the session from it.
  await page.getByRole("link", { name: "Keep going" }).click();
  await expect(page.getByRole("link", { name: "Matches 1" })).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Solo night"
  );
  await expect(page.getByRole("link", { name: "Find a movie" })).toBeVisible();

  // Seen answers went to the seen list; the last match became history.
  const user = await db.query.users.findFirst({ where: { email } });
  const seen = await db
    .select({ movieId: seenMovies.movieId })
    .from(seenMovies)
    .where(eq(seenMovies.userId, user?.id ?? ""));
  expect(seen.map((row) => row.movieId).sort()).toEqual(
    [movies[0]?.id, movies[1]?.id].sort()
  );
  const past = await db
    .select({ movieId: groupPastMatches.movieId })
    .from(groupPastMatches)
    .where(eq(groupPastMatches.groupId, groupIds.at(-1) ?? ""));
  expect(past).toEqual([{ movieId: movies[2]?.id }]);
});

test("a save that loses its response is retried once, not twice", async ({
  page,
}) => {
  const { email } = await signInWithGroup(page);
  await startSession(page);
  await expect(cardTitle(page)).toHaveText(title(0));

  // The answer reaches the server, but the reply never reaches the browser.
  await page.route(
    (url) => url.searchParams.has("/answer"),
    async (route) => {
      await route.fetch();
      await route.abort();
    },
    { times: 1 }
  );
  await page.getByRole("button", { name: "Not seen" }).click();
  // The next card shows at once; the failed save waits for a retry.
  await expect(cardTitle(page)).toHaveText(title(1));
  await expect(page.getByText("Couldn't save your answer")).toBeVisible();

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Couldn't save your answer")).toBeHidden();
  await expect(page.getByRole("link", { name: "Matches 1" })).toBeVisible();

  const logged = await db
    .select({ type: actions.type })
    .from(actions)
    .innerJoin(users, eq(users.id, actions.userId))
    .where(
      and(eq(users.email, email), eq(actions.type, "watch_answer_not_seen"))
    );
  expect(logged).toHaveLength(1);
});

test("leaving the deck waits for answers still being saved", async ({
  page,
}) => {
  await signInWithGroup(page);
  await startSession(page);
  await expect(cardTitle(page)).toHaveText(title(0));

  // Slow down the first save so the second answer is still queued (not yet
  // sent) when the person taps Matches.
  await page.route(
    (url) => url.searchParams.has("/answer"),
    async (route) => {
      await new Promise((done) => setTimeout(done, 1000));
      await route.continue();
    },
    { times: 1 }
  );
  await page.getByRole("button", { name: "Not seen" }).click();
  await page.getByRole("button", { name: "Not seen" }).click();
  await page.getByRole("link", { name: /^Matches/ }).click();

  await expect(page).toHaveURL(/\/shortlist$/);
  await expect(page.getByRole("listitem")).toHaveCount(2);
});

test("a start that loses the race to someone else's shows their session", async ({
  page,
}) => {
  await signInWithGroup(page);
  const groupId = groupIds.at(-1) ?? "";
  await page.getByRole("link", { name: "Find a movie" }).click();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();

  // Another member starts a session while this page is open.
  const other = await fixtures.user();
  await db
    .insert(groupMembers)
    .values({ groupId, userId: other, role: "member", nickname: "Other" });
  expect(
    await startWatchSession(db, {
      actionId: crypto.randomUUID(),
      userId: other,
      groupId,
      watchSessionId: crypto.randomUUID(),
      filters: NO_FILTERS,
      replacedWatchSessionId: null,
      invitedUserIds: [],
    })
  ).toBe("applied");

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("A session is already going")).toBeVisible();
  // Only its host can replace it.
  await expect(
    page.getByRole("link", { name: "Start a new one" })
  ).toBeHidden();
  await expect(
    page.getByRole("link", { name: "Back to Solo night" })
  ).toBeVisible();
});
