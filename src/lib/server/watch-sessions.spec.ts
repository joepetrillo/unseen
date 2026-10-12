import { inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  groupMembers,
  groupPastMatches,
  groups,
  movieGenres,
  type NewMovie,
  watchSessionParticipants,
} from "#lib/server/db/schema.ts";
import { createGroup } from "#lib/server/groups.ts";
import { addToSeenList } from "#lib/server/seen-list.ts";
import { connectTestDb, createFixtures } from "#lib/server/testing/db.ts";
import {
  answerMovie,
  canUndo,
  dealCards,
  endWatchSession,
  getActiveWatchSessionId,
  listMatches,
  startWatchSession,
  undoLastAnswer,
  VOTE_COUNT_FLOOR,
} from "#lib/server/watch-sessions.ts";
import { NO_FILTERS, type WatchFilters } from "#lib/watch-fields.ts";

// Runs against a real database: the deck and matches are SQL, and row locks
// and unique indexes are what keep sessions consistent.
const { pool, db } = connectTestDb();
const fixtures = createFixtures(db);
// Deleting users leaves their groups (and so sessions) behind; track them.
const groupIds: string[] = [];

afterAll(async () => {
  if (groupIds.length > 0) {
    await db.delete(groups).where(inArray(groups.id, groupIds));
  }
  await fixtures.cleanUp();
  await pool.end();
});

const id = () => crypto.randomUUID();

/**
 * A user in their own group, plus a genre every test movie belongs to. Each
 * session filters on that genre, so other test files' movies (same database,
 * running in parallel) never reach these decks.
 */
interface World {
  userId: string;
  groupId: string;
  genreId: number;
}

async function newWorld(): Promise<World> {
  const userId = await fixtures.user();
  const groupId = id();
  groupIds.push(groupId);
  await createGroup(db, {
    actionId: id(),
    userId,
    groupId,
    name: "Movie night",
    nickname: "Me",
  });
  return { userId, groupId, genreId: await fixtures.genre() };
}

/** A dealable movie (enough votes, released) in the world's genre. */
async function movie(
  world: World,
  fields: Partial<NewMovie> & { genreIds?: number[] } = {}
): Promise<number> {
  const { genreIds = [world.genreId], ...movieFields } = fields;
  const movieId = await fixtures.movie({
    voteCount: VOTE_COUNT_FLOOR + 1000,
    releaseDate: "2000-06-01",
    usReleaseDate: "2000-06-01",
    runtime: 100,
    ...movieFields,
  });
  if (genreIds.length > 0) {
    await db
      .insert(movieGenres)
      .values(genreIds.map((genreId) => ({ movieId, genreId })));
  }
  return movieId;
}

interface Session {
  id: string;
  participationId: string;
}

async function start(
  world: World,
  filters: Partial<WatchFilters> = {},
  replacedWatchSessionId: string | null = null
): Promise<Session> {
  const watchSessionId = id();
  const outcome = await startWatchSession(db, {
    actionId: id(),
    userId: world.userId,
    groupId: world.groupId,
    watchSessionId,
    filters: { ...NO_FILTERS, genreIds: [world.genreId], ...filters },
    replacedWatchSessionId,
  });
  expect(outcome).toBe("applied");
  return {
    id: watchSessionId,
    participationId: await participation(world.userId, watchSessionId),
  };
}

async function participation(userId: string, watchSessionId: string) {
  const row = await db.query.watchSessionParticipants.findFirst({
    columns: { id: true },
    where: { userId, watchSessionId },
  });
  if (row === undefined) throw new Error("no participation");
  return row.id;
}

async function deal(session: Session, exclude: number[] = []) {
  const cards = await dealCards(db, {
    watchSessionId: session.id,
    participationId: session.participationId,
    exclude,
    limit: 50,
  });
  return cards.map((card) => card.id);
}

function answer(
  world: World,
  session: Session,
  movieId: number,
  choice: "seen" | "not_seen",
  actionId = id()
) {
  return answerMovie(db, {
    actionId,
    userId: world.userId,
    participationId: session.participationId,
    movieId,
    answer: choice,
  });
}

function undo(world: World, session: Session, actionId = id()) {
  return undoLastAnswer(db, {
    actionId,
    userId: world.userId,
    participationId: session.participationId,
  });
}

async function matchIds(session: Session) {
  return (await listMatches(db, session.id)).map((card) => card.id);
}

async function seenList(userId: string) {
  const rows = await db.query.seenMovies.findMany({
    columns: { movieId: true },
    where: { userId },
  });
  return rows.map((row) => row.movieId);
}

async function seenVersion(userId: string) {
  const user = await db.query.users.findFirst({
    columns: { seenVersion: true },
    where: { id: userId },
  });
  return user?.seenVersion;
}

async function revision(watchSessionId: string) {
  const session = await db.query.watchSessions.findFirst({
    columns: { revision: true },
    where: { id: watchSessionId },
  });
  return session?.revision;
}

/** Another person in the same session (stage 7 adds a real way in). */
async function addGuest(session: Session): Promise<World & Session> {
  const userId = await fixtures.user();
  const [row] = await db
    .insert(watchSessionParticipants)
    .values({
      watchSessionId: session.id,
      userId,
      role: "guest",
      joinedAt: new Date(),
    })
    .returning({ id: watchSessionParticipants.id });
  if (row === undefined) throw new Error("no guest");
  return {
    userId,
    groupId: "",
    genreId: 0,
    id: session.id,
    participationId: row.id,
  };
}

let world: World;

beforeEach(async () => {
  world = await newWorld();
});

describe("deck order", () => {
  it("deals the most-voted first, then by movie ID, above the vote floor", async () => {
    const few = await movie(world, { voteCount: 300 });
    const many = await movie(world, { voteCount: 90_000 });
    const tieLow = await movie(world, { id: 1_100_000_001, voteCount: 5000 });
    const tieHigh = await movie(world, { id: 1_100_000_002, voteCount: 5000 });
    await movie(world, { voteCount: VOTE_COUNT_FLOOR - 1 });
    const session = await start(world);

    expect(await deal(session)).toEqual([many, tieLow, tieHigh, few]);
  });

  it("leaves out movies not yet released in the US", async () => {
    const released = await movie(world);
    await movie(world, { usReleaseDate: null });
    await movie(world, { usReleaseDate: "2999-01-01" });
    const session = await start(world);

    expect(await deal(session)).toEqual([released]);
  });

  it("puts movies others answered Not seen first", async () => {
    const popular = await movie(world, { voteCount: 90_000 });
    const started = await movie(world, { voteCount: 1000 });
    const session = await start(world);
    const guest = await addGuest(session);
    expect(await answer(guest, guest, started, "not_seen")).toBe("applied");

    expect(await deal(session)).toEqual([started, popular]);
  });

  it("deals the group's earlier matches last", async () => {
    const passedOn = await movie(world, { voteCount: 90_000 });
    const fresh = await movie(world, { voteCount: 1000 });
    const first = await start(world);
    await answer(world, first, passedOn, "not_seen");
    expect(
      await endWatchSession(db, {
        actionId: id(),
        userId: world.userId,
        watchSessionId: first.id,
      })
    ).toBe("applied");

    const second = await start(world);
    expect(await deal(second)).toEqual([fresh, passedOn]);
  });

  it("counts matches recorded by the session a start replaces", async () => {
    const passedOn = await movie(world, { voteCount: 90_000 });
    const fresh = await movie(world, { voteCount: 1000 });
    const first = await start(world);
    await answer(world, first, passedOn, "not_seen");

    // Change filters: closing `first` and starting `second` share one
    // transaction, so the matches and the new session share a timestamp.
    const second = await start(world, {}, first.id);
    expect(await deal(second)).toEqual([fresh, passedOn]);
  });

  it("ignores matches recorded after the session started", async () => {
    const popular = await movie(world, { voteCount: 90_000 });
    const other = await movie(world, { voteCount: 1000 });
    const session = await start(world);
    await db.insert(groupPastMatches).values({
      groupId: world.groupId,
      movieId: popular,
      recordedAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(await deal(session)).toEqual([popular, other]);
  });

  it("skips the cards already on screen", async () => {
    const a = await movie(world, { voteCount: 3000 });
    const b = await movie(world, { voteCount: 2000 });
    const c = await movie(world, { voteCount: 1000 });
    const session = await start(world);

    expect(await deal(session, [a, b])).toEqual([c]);
  });
});

describe("seen exclusion", () => {
  it("never deals a movie on the participant's seen list", async () => {
    const seen = await movie(world, { voteCount: 90_000 });
    const unseen = await movie(world);
    await addToSeenList(db, {
      actionId: id(),
      userId: world.userId,
      movieId: seen,
    });
    const session = await start(world);

    expect(await deal(session)).toEqual([unseen]);
  });

  it("never deals a movie on another participant's seen list", async () => {
    const seenByGuest = await movie(world, { voteCount: 90_000 });
    const unseen = await movie(world);
    const session = await start(world);
    const guest = await addGuest(session);
    await addToSeenList(db, {
      actionId: id(),
      userId: guest.userId,
      movieId: seenByGuest,
    });

    expect(await deal(session)).toEqual([unseen]);
  });

  it("stops dealing a movie once answered, and Seen adds it to the list", async () => {
    const a = await movie(world, { voteCount: 3000 });
    const b = await movie(world, { voteCount: 2000 });
    const c = await movie(world, { voteCount: 1000 });
    const session = await start(world);
    const before = await seenVersion(world.userId);

    await answer(world, session, a, "seen");
    await answer(world, session, b, "not_seen");

    expect(await deal(session)).toEqual([c]);
    expect(await seenList(world.userId)).toEqual([a]);
    expect(await seenVersion(world.userId)).toBe((before ?? 0) + 1);
  });
});

describe("filters", () => {
  it("keeps movies up to the runtime, and drops unknown runtimes only then", async () => {
    const short = await movie(world, { runtime: 90 });
    const long = await movie(world, { runtime: 150 });
    const unknown = await movie(world, { runtime: null });

    const limited = await start(world, { maxRuntime: 120 });
    expect(await deal(limited)).toEqual([short]);

    const open = await start(world, {}, limited.id);
    expect((await deal(open)).sort()).toEqual([short, long, unknown].sort());
  });

  it("keeps the year range by primary release date", async () => {
    const before = await movie(world, { releaseDate: "1989-12-31" });
    const first = await movie(world, { releaseDate: "1990-01-01" });
    const last = await movie(world, { releaseDate: "1999-12-31" });
    const after = await movie(world, { releaseDate: "2000-01-01" });
    const unknown = await movie(world, { releaseDate: null });

    const nineties = await start(world, { minYear: 1990, maxYear: 1999 });
    expect((await deal(nineties)).sort()).toEqual([first, last].sort());

    const since = await start(world, { minYear: 1990 }, nineties.id);
    expect((await deal(since)).sort()).toEqual([first, last, after].sort());

    const open = await start(world, {}, since.id);
    expect((await deal(open)).sort()).toEqual(
      [before, first, last, after, unknown].sort()
    );
  });

  it("treats several genres as any of them", async () => {
    const comedy = await fixtures.genre();
    const drama = await fixtures.genre();
    const funny = await movie(world, { genreIds: [world.genreId, comedy] });
    const sad = await movie(world, { genreIds: [drama] });
    const both = await movie(world, { genreIds: [comedy, drama] });
    await movie(world, { genreIds: [] });

    const session = await start(world, { genreIds: [comedy, drama] });
    expect((await deal(session)).sort()).toEqual([funny, sad, both].sort());
  });
});

describe("answers and matches", () => {
  it("makes a match of a solo Not seen, and none of a Seen", async () => {
    const notSeen = await movie(world);
    const seen = await movie(world);
    const session = await start(world);
    await answer(world, session, notSeen, "not_seen");
    await answer(world, session, seen, "seen");

    expect(await matchIds(session)).toEqual([notSeen]);
  });

  it("needs every participant's Not seen", async () => {
    const m = await movie(world);
    const session = await start(world);
    const guest = await addGuest(session);
    await answer(world, session, m, "not_seen");
    expect(await matchIds(session)).toEqual([]);

    await answer(guest, guest, m, "not_seen");
    expect(await matchIds(session)).toEqual([m]);
  });

  it("drops a match when someone turns out to have seen it", async () => {
    const corrected = await movie(world);
    const markedElsewhere = await movie(world);
    const session = await start(world);
    await answer(world, session, corrected, "not_seen");
    await answer(world, session, markedElsewhere, "not_seen");

    // "Actually, I've seen this" in the shortlist.
    await answer(world, session, corrected, "seen");
    // Marked on the Seen movies page instead.
    await addToSeenList(db, {
      actionId: id(),
      userId: world.userId,
      movieId: markedElsewhere,
    });

    expect(await matchIds(session)).toEqual([]);
    expect((await seenList(world.userId)).sort()).toEqual(
      [corrected, markedElsewhere].sort()
    );
  });

  it("ignores a late Not seen on a movie someone has seen", async () => {
    const m = await movie(world);
    const session = await start(world);
    const guest = await addGuest(session);
    await answer(guest, guest, m, "seen");

    expect(await answer(world, session, m, "not_seen")).toBe("applied");
    const answers = await db.query.watchSessionAnswers.findMany({
      where: { participationId: session.participationId },
    });
    expect(answers).toEqual([]);
  });

  it("bumps the session's revision on every change", async () => {
    const m = await movie(world);
    const session = await start(world);
    const before = await revision(session.id);
    await answer(world, session, m, "not_seen");
    await undo(world, session);
    expect(await revision(session.id)).toBe((before ?? 0) + 2);
  });

  it("refuses a movie that isn't in the catalog", async () => {
    const session = await start(world);
    expect(await answer(world, session, 1_999_999_999, "seen")).toBe(
      "movie_not_found"
    );
  });
});

describe("undo", () => {
  it("takes back a Not seen: no match, and the movie is dealt again", async () => {
    const m = await movie(world);
    const session = await start(world);
    await answer(world, session, m, "not_seen");

    const result = await undo(world, session);
    expect(result).toEqual({ outcome: "applied", movieId: m });
    expect(await matchIds(session)).toEqual([]);
    expect(await deal(session)).toEqual([m]);
  });

  it("steps back through the person's answers, newest first", async () => {
    const a = await movie(world);
    const b = await movie(world);
    const session = await start(world);
    await answer(world, session, a, "not_seen");
    await answer(world, session, b, "seen");

    expect((await undo(world, session)).movieId).toBe(b);
    expect((await undo(world, session)).movieId).toBe(a);
    expect(await undo(world, session)).toEqual({
      outcome: "nothing_to_undo",
      movieId: null,
    });
    expect(await canUndo(db, session.participationId)).toBe(false);
  });

  it("takes back a Seen: the movie leaves the seen list", async () => {
    const m = await movie(world);
    const session = await start(world);
    await answer(world, session, m, "seen");
    const before = await seenVersion(world.userId);

    await undo(world, session);
    expect(await seenList(world.userId)).toEqual([]);
    expect(await seenVersion(world.userId)).toBe((before ?? 0) + 1);
  });

  it("keeps the seen entry if the movie was confirmed again elsewhere", async () => {
    const m = await movie(world);
    const session = await start(world);
    await answer(world, session, m, "seen");
    // Confirmed again on the Seen movies page after the answer.
    await addToSeenList(db, {
      actionId: id(),
      userId: world.userId,
      movieId: m,
    });

    expect((await undo(world, session)).outcome).toBe("applied");
    expect(await seenList(world.userId)).toEqual([m]);
  });

  it("keeps the seen entry if another session confirmed it later", async () => {
    const m = await movie(world);
    const session = await start(world);
    await answer(world, session, m, "seen");

    const otherWorld = { ...(await newWorld()), userId: world.userId };
    await createGroupMembership(otherWorld);
    const other = await start(otherWorld, { genreIds: [world.genreId] });
    await answer(otherWorld, other, m, "seen");

    await undo(world, session);
    expect(await seenList(world.userId)).toEqual([m]);
  });

  it("undoing a correction brings back the Not seen and the match", async () => {
    const m = await movie(world);
    const session = await start(world);
    await answer(world, session, m, "not_seen");
    await answer(world, session, m, "seen");
    expect(await matchIds(session)).toEqual([]);

    await undo(world, session);
    expect(await matchIds(session)).toEqual([m]);
    expect(await seenList(world.userId)).toEqual([]);
  });

  it("answers a retried undo with the same movie and changes nothing", async () => {
    const a = await movie(world);
    const b = await movie(world);
    const session = await start(world);
    await answer(world, session, a, "not_seen");
    await answer(world, session, b, "not_seen");
    const undoId = id();

    expect(await undo(world, session, undoId)).toEqual({
      outcome: "applied",
      movieId: b,
    });
    expect(await undo(world, session, undoId)).toEqual({
      outcome: "duplicate",
      movieId: b,
    });
    expect(await matchIds(session)).toEqual([a]);
  });
});

describe("starting and ending", () => {
  it("allows one active session per group; a start must name the one it replaces", async () => {
    const m = await movie(world);
    const first = await start(world);
    await answer(world, first, m, "not_seen");

    const attempt = (replaced: string | null) =>
      startWatchSession(db, {
        actionId: id(),
        userId: world.userId,
        groupId: world.groupId,
        watchSessionId: id(),
        filters: NO_FILTERS,
        replacedWatchSessionId: replaced,
      });
    expect(await attempt(null)).toBe("session_active");
    expect(await attempt(id())).toBe("session_active");
    expect(await getActiveWatchSessionId(db, world.groupId)).toBe(first.id);

    const second = await start(world, {}, first.id);
    expect(await getActiveWatchSessionId(db, world.groupId)).toBe(second.id);
    // The replaced session's match was recorded, and it's closed for good.
    const past = await db.query.groupPastMatches.findMany({
      where: { groupId: world.groupId },
    });
    expect(past.map((row) => row.movieId)).toEqual([m]);
    expect(await answer(world, first, m, "seen")).toBe("session_closed");
  });

  it("lets only one of several simultaneous starts in a group through", async () => {
    const attempt = () =>
      startWatchSession(db, {
        actionId: id(),
        userId: world.userId,
        groupId: world.groupId,
        watchSessionId: id(),
        filters: NO_FILTERS,
        replacedWatchSessionId: null,
      });
    // Several at once, so at least two overlap on the test pool's two
    // connections.
    const outcomes = await Promise.all(Array.from({ length: 6 }, attempt));
    expect(outcomes.filter((outcome) => outcome === "applied")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome !== "applied")).toEqual(
      Array.from({ length: 5 }, () => "session_active")
    );
  });

  it("treats a retried start as the same session; another input conflicts", async () => {
    const actionId = id();
    const watchSessionId = id();
    const input = {
      actionId,
      userId: world.userId,
      groupId: world.groupId,
      watchSessionId,
      filters: { ...NO_FILTERS, genreIds: [world.genreId] },
      replacedWatchSessionId: null,
    };
    expect(await startWatchSession(db, input)).toBe("applied");
    expect(await startWatchSession(db, input)).toBe("duplicate");
    expect(
      await startWatchSession(db, {
        ...input,
        filters: { ...input.filters, maxRuntime: 90 },
      })
    ).toBe("conflict");
  });

  it("refuses non-members, the same as a missing group", async () => {
    const stranger = await fixtures.user();
    const outcome = await startWatchSession(db, {
      actionId: id(),
      userId: stranger,
      groupId: world.groupId,
      watchSessionId: id(),
      filters: NO_FILTERS,
      replacedWatchSessionId: null,
    });
    expect(outcome).toBe("not_found");
    expect(
      await startWatchSession(db, {
        actionId: id(),
        userId: stranger,
        groupId: id(),
        watchSessionId: id(),
        filters: NO_FILTERS,
        replacedWatchSessionId: null,
      })
    ).toBe("not_found");
  });

  it("lets only the host end a session, once", async () => {
    const session = await start(world);
    const guest = await addGuest(session);
    await createGroupMembership({ ...world, userId: guest.userId });
    const end = (userId: string) =>
      endWatchSession(db, {
        actionId: id(),
        userId,
        watchSessionId: session.id,
      });

    expect(await end(guest.userId)).toBe("not_host");
    expect(await end(world.userId)).toBe("applied");
    expect(await end(world.userId)).toBe("session_closed");
    expect(await getActiveWatchSessionId(db, world.groupId)).toBe(null);
  });

  it("rejects answers on someone else's participation, or a removed one", async () => {
    const m = await movie(world);
    const session = await start(world);
    const guest = await addGuest(session);

    expect(
      await answerMovie(db, {
        actionId: id(),
        userId: guest.userId,
        participationId: session.participationId,
        movieId: m,
        answer: "seen",
      })
    ).toBe("not_found");

    await db
      .update(watchSessionParticipants)
      .set({ removedAt: new Date() })
      .where(inArray(watchSessionParticipants.id, [guest.participationId]));
    expect(await answer(guest, guest, m, "not_seen")).toBe("not_participating");
  });
});

// Adds world.userId to world.groupId's members (a second group for the same
// user, or a guest who needs to be in the group).
async function createGroupMembership(target: World): Promise<void> {
  await db
    .insert(groupMembers)
    .values({
      groupId: target.groupId,
      userId: target.userId,
      role: "member",
      nickname: `Member ${id().slice(0, 8)}`,
    })
    .onConflictDoNothing();
}
