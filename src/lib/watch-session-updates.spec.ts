import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DeckState, PollReply } from "#lib/watch-fields.ts";
import {
  FASTEST_MS,
  SLOWEST_MS,
  subscribeToWatchSession,
} from "#lib/watch-session-updates.ts";

// The poll loop's timing and race rules, with fake timers and a fake server
// whose replies the test releases one at a time.

function state(fingerprint: string): DeckState {
  return {
    cards: [],
    matchCount: 0,
    canUndo: false,
    fingerprint,
    waitingOn: null,
    ruledOut: null,
  };
}

const changed = (fingerprint: string): PollReply => ({
  status: "changed",
  state: state(fingerprint),
});

/** A server that answers only when the test says so. */
function fakeServer() {
  const requests: { url: string; answer: (reply: PollReply | null) => void }[] =
    [];
  const fetch = vi.fn(
    (url: string) =>
      new Promise<Response>((resolve, reject) => {
        requests.push({
          url,
          answer: (reply) => {
            if (reply === null) {
              reject(new TypeError("offline"));
              return;
            }
            resolve(Response.json(reply));
          },
        });
      })
  );
  return {
    fetch: fetch as unknown as typeof globalThis.fetch,
    requests,
    /** Answers the oldest unanswered request. */
    async answer(reply: PollReply | null) {
      const next = requests.shift();
      if (next === undefined) throw new Error("no request waiting");
      next.answer(reply);
      // Let the reply's promise chain run.
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

function subscribe(server: ReturnType<typeof fakeServer>) {
  const onChange = vi.fn();
  const onConnection = vi.fn();
  const subscription = subscribeToWatchSession("session-1", {
    fingerprint: "f0",
    query: () => ({ participationId: "p1" }),
    onChange,
    onConnection,
    fetch: server.fetch,
  });
  return { subscription, onChange, onConnection };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("subscribeToWatchSession", () => {
  it("sends the fingerprint it has, and reports only changes", async () => {
    const server = fakeServer();
    const { subscription, onChange } = subscribe(server);

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    expect(server.requests[0]?.url).toContain("since=f0");
    expect(server.requests[0]?.url).toContain("participationId=p1");
    await server.answer({ status: "unchanged" });
    expect(onChange).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SLOWEST_MS);
    await server.answer(changed("f1"));
    expect(onChange).toHaveBeenCalledWith(changed("f1"));

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    expect(server.requests[0]?.url).toContain("since=f1");
    subscription.stop();
  });

  it("backs off while nothing changes, and speeds up after a change", async () => {
    const server = fakeServer();
    const { subscription } = subscribe(server);
    const times: number[] = [];
    let last = Date.now();
    const step = async (reply: PollReply) => {
      // Advance until the next request goes out.
      while (server.requests.length === 0) {
        await vi.advanceTimersByTimeAsync(100);
      }
      times.push(Date.now() - last);
      await server.answer(reply);
      last = Date.now();
    };

    for (let i = 0; i < 6; i++) await step({ status: "unchanged" });
    await step(changed("f1"));
    await step({ status: "unchanged" });

    // 2.5 s, then slower each time up to 10 s; fast again after the change.
    expect(times[0]).toBe(FASTEST_MS);
    expect(times[1]).toBeGreaterThan(FASTEST_MS);
    expect(times[5]).toBe(SLOWEST_MS);
    expect(times[7]).toBe(FASTEST_MS);
    subscription.stop();
  });

  it("never has two polls out at once", async () => {
    const server = fakeServer();
    const { subscription } = subscribe(server);

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    // A slow reply: much longer than the interval, and a release that asks
    // for a poll right away.
    subscription.hold()();
    await vi.advanceTimersByTimeAsync(SLOWEST_MS * 3);
    expect(server.requests).toHaveLength(1);
    subscription.stop();
  });

  it("doesn't poll while a save is on its way", async () => {
    const server = fakeServer();
    const { subscription } = subscribe(server);

    const release = subscription.hold();
    await vi.advanceTimersByTimeAsync(SLOWEST_MS * 3);
    expect(server.requests).toHaveLength(0);

    // Released: a fresh poll goes out at once.
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.requests).toHaveLength(1);
    subscription.stop();
  });

  it("ignores a reply to a poll that started before a save", async () => {
    const server = fakeServer();
    const { subscription, onChange } = subscribe(server);

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    // The poll is out; then you answer a card.
    const release = subscription.hold();
    // The stale reply describes the session before your answer.
    await server.answer(changed("before-save"));
    expect(onChange).not.toHaveBeenCalled();

    // The save's own reply is what the screen shows now.
    subscription.saw("after-save");
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.requests[0]?.url).toContain("since=after-save");
    subscription.stop();
  });

  it("ignores a stale reply even when the save finished first", async () => {
    const server = fakeServer();
    const { subscription, onChange } = subscribe(server);

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    subscription.hold()();
    await server.answer(changed("before-save"));
    expect(onChange).not.toHaveBeenCalled();
    // Then a fresh poll replaces it.
    expect(server.requests).toHaveLength(1);
    subscription.stop();
  });

  it("keeps trying after a failed poll, and says so", async () => {
    const server = fakeServer();
    const { subscription, onConnection, onChange } = subscribe(server);

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    await server.answer(null);
    expect(onConnection).toHaveBeenLastCalledWith(false);

    await vi.advanceTimersByTimeAsync(SLOWEST_MS);
    await server.answer(changed("f1"));
    expect(onConnection).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledOnce();
    subscription.stop();
  });

  it("counts a reply in an unexpected shape as a failed poll", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(Response.json({ status: "changed" }))
    );
    const onChange = vi.fn();
    const onConnection = vi.fn();
    const subscription = subscribeToWatchSession("session-1", {
      fingerprint: "f0",
      query: () => ({}),
      onChange,
      onConnection,
      fetch,
    });

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    expect(onConnection).toHaveBeenLastCalledWith(false);
    expect(onChange).not.toHaveBeenCalled();
    // And it keeps polling.
    await vi.advanceTimersByTimeAsync(SLOWEST_MS);
    expect(fetch).toHaveBeenCalledTimes(2);
    subscription.stop();
  });

  it("ends when the poll was sent to the sign-in page", async () => {
    // What fetch returns after following the sign-in redirect.
    const signInPage = new Response("<html></html>");
    Object.defineProperties(signInPage, {
      redirected: { value: true },
      url: { value: "https://vunu.test/sign-in?redirectTo=%2Fsessions" },
    });
    const fetch = vi.fn(() => Promise.resolve(signInPage));
    const onChange = vi.fn();
    subscribeToWatchSession("session-1", {
      fingerprint: "f0",
      query: () => ({}),
      onChange,
      fetch,
    });

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    expect(onChange).toHaveBeenCalledWith({ status: "ended" });
    await vi.advanceTimersByTimeAsync(SLOWEST_MS * 3);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("stops once the session has ended for you", async () => {
    const server = fakeServer();
    const { onChange } = subscribe(server);

    await vi.advanceTimersByTimeAsync(FASTEST_MS);
    await server.answer({ status: "ended" });
    expect(onChange).toHaveBeenCalledWith({ status: "ended" });

    await vi.advanceTimersByTimeAsync(SLOWEST_MS * 3);
    expect(server.requests).toHaveLength(0);
  });
});
