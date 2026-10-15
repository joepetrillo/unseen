import { type PollReply, pollReplySchema } from "#lib/deck-fields.ts";

// The browser's side of live updates (spec section 5). It polls today; a
// real-time service would replace this module and the server's counters
// (notifyGroupChanged, users.seen_version), while the fingerprint stays as
// the safety net.

/** Poll this often while things change, backing off to SLOWEST when idle. */
export const FASTEST_MS = 2500;
export const SLOWEST_MS = 10_000;
const BACKOFF = 1.5;

export interface DeckSubscription {
  /**
   * Pauses polling while a change is being saved. Call the returned function
   * once the server has answered: a poll that started before the save could
   * describe the deck without it, so its reply is thrown away, and a
   * fresh poll follows.
   */
  hold(): () => void;
  /** The caller already shows the state with this fingerprint (a save's reply). */
  saw(fingerprint: string): void;
  stop(): void;
}

interface Options {
  /** The fingerprint of the state on screen. */
  fingerprint: string;
  /** The rest of the poll's query (preferences, cards on screen). */
  query: () => string | Record<string, string>;
  /** Something changed, or you left the group (then polling stops). */
  onChange: (reply: Exclude<PollReply, { status: "unchanged" }>) => void;
  /** Whether the last poll reached the server. */
  onConnection?: (ok: boolean) => void;
  /** For tests. */
  fetch?: typeof fetch;
}

/**
 * Polls a group's deck at `pollUrl`, one request at a time, and reports only
 * changes. Fast while things change, slower while they don't, paused while
 * the page is in the background or a save is on its way, and immediate when
 * the page comes back into view or the connection returns.
 */
export function subscribeToDeck(
  pollUrl: string,
  options: Options
): DeckSubscription {
  const request = options.fetch ?? fetch.bind(globalThis);
  let fingerprint = options.fingerprint;
  let delay = FASTEST_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let polling = false;
  // Poll again as soon as the current one returns.
  let again = false;
  let holds = 0;
  // Counts holds ever taken; a reply is used only if none began since its
  // request went out.
  let epoch = 0;
  let stopped = false;

  // No document in unit tests (Node): there the page always counts as open.
  const inBrowser = typeof document !== "undefined";
  const hidden = () => inBrowser && document.visibilityState === "hidden";
  // Read through functions: stop() and soon() can run while a poll awaits,
  // which TypeScript's narrowing can't see.
  const ended = () => stopped;
  const wanted = () => again;

  function schedule(ms: number): void {
    clearTimeout(timer);
    timer = undefined;
    if (stopped || holds > 0 || hidden()) return;
    timer = setTimeout(() => void poll(), ms);
  }

  // Now, or right after the poll on its way: polls never overlap.
  function soon(): void {
    if (polling) again = true;
    else schedule(0);
  }

  async function poll(): Promise<void> {
    if (stopped || polling || holds > 0 || hidden()) return;
    polling = true;
    again = false;
    const startedAt = epoch;
    const reply = await get();
    polling = false;
    if (ended()) return;

    if (startedAt !== epoch) {
      // A save began while this was out: the reply may predate it.
      schedule(0);
      return;
    }
    if (reply === null) {
      options.onConnection?.(false);
      delay = Math.min(delay * 2, SLOWEST_MS);
    } else {
      options.onConnection?.(true);
      if (reply.status === "unchanged") {
        delay = Math.min(delay * BACKOFF, SLOWEST_MS);
      } else if (reply.status === "changed") {
        fingerprint = reply.state.fingerprint;
        delay = FASTEST_MS;
        options.onChange(reply);
      } else {
        stop();
        options.onChange(reply);
        return;
      }
    }
    schedule(wanted() ? 0 : delay);
  }

  async function get(): Promise<PollReply | null> {
    const params = new URLSearchParams(options.query());
    params.set("since", fingerprint);
    try {
      const response = await request(`${pollUrl}?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      // Signed out (the session expired): the poll was redirected to the
      // sign-in page. Reloading the page takes the person there and back.
      if (
        response.redirected &&
        new URL(response.url).pathname === "/sign-in"
      ) {
        return { status: "ended" };
      }
      if (!response.ok) return null;
      // A reply in any other shape (a different deployment, say) counts as
      // a failed poll rather than breaking the loop.
      const reply = pollReplySchema.safeParse(
        await response.json().catch(() => null)
      );
      return reply.success ? reply.data : null;
    } catch {
      return null;
    }
  }

  // Back in view, or back online: catch up at once, at full speed.
  function wake(): void {
    if (hidden()) return;
    delay = FASTEST_MS;
    soon();
  }

  function stop(): void {
    stopped = true;
    clearTimeout(timer);
    if (!inBrowser) return;
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("focus", wake);
    window.removeEventListener("online", wake);
  }

  if (inBrowser) {
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
  }
  schedule(delay);

  return {
    hold() {
      holds += 1;
      epoch += 1;
      clearTimeout(timer);
      timer = undefined;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds -= 1;
        // You just acted, so others may be about to: poll fast again.
        delay = FASTEST_MS;
        if (holds === 0) soon();
      };
    },
    saw(next) {
      fingerprint = next;
    },
    stop,
  };
}
