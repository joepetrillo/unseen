import { type ActionResult, deserialize } from "$app/forms";

import {
  type DeckState,
  type MovieCard,
  REVIEW_PROMPT_AT,
} from "#lib/watch-fields.ts";
import {
  subscribeToWatchSession,
  type WatchSessionSubscription,
} from "#lib/watch-session-updates.ts";

export type Answer = "seen" | "not_seen";

interface Save {
  /** Kept until the server answers, so a retry resends the same ID. */
  actionId: string;
  card: MovieCard;
  answer: Answer;
}

interface UndoReply {
  card: MovieCard | null;
  matchCount: number;
  canUndo: boolean;
}

interface Refusal {
  message: string;
  code?: string;
}

// Kit's ActionResult accepts only plain object types (which have an implied
// index signature); this copies an interface's fields into one.
type Plain<T> = { [K in keyof T]: T[K] };

const SAVE_FAILED = "Couldn't save your answer. Check your connection.";
const UNDO_FAILED = "Couldn't undo. Check your connection and try again.";

/**
 * The deck on screen: the visible card, a short queue behind it, and the
 * answers on their way to the server (spec section 1, "Deck ordering").
 *
 * - Answering shows the next card at once; the save goes out in the
 *   background. Saves are sent one at a time, in order, each with an action
 *   ID kept until the server answers.
 * - Each save's reply carries the server's current top cards, which replace
 *   the queue. The visible card never changes under you.
 * - Undo takes back an answer that hasn't been sent yet right here, and
 *   otherwise waits for the save in flight, then asks the server.
 * - Between saves, a poll (`connect`) brings in other people's changes the
 *   same way. Polls pause while a save or undo is on its way, and a poll
 *   that started before one is ignored, so it can't undo what you just did.
 *   The card on screen stays even if someone else rules it out meanwhile: a
 *   card that moved as you tapped would take your answer.
 *
 * A class with `$state` fields, in a .svelte.ts module so runes work: the
 * page reads `deck.cards` and updates when it changes, with no store.
 */
export class Deck {
  /** [0] is on screen; the rest wait behind it. Replaced, never mutated. */
  cards = $state.raw<MovieCard[]>([]);
  matchCount = $state(0);
  /** Answers not yet confirmed by the server. */
  pending = $state(0);
  /** A save is on its way. */
  saving = $state(false);
  undoing = $state(false);
  /** A save failed with no answer from the server; `retry()` resends it. */
  error = $state<string | null>(null);
  undoError = $state<string | null>(null);
  /** The session refused a change (it ended, say): only a reload helps. */
  refused = $state<string | null>(null);
  /** Turns on when matches reach REVIEW_PROMPT_AT during this visit. */
  reviewPrompt = $state(false);
  /** The latest answer, so the card can leave in that answer's direction. */
  lastAnswer = $state<Answer>("not_seen");
  /**
   * With nothing left for you to answer: who still has movies to answer.
   * Empty means nobody does (the filters are used up); null, not known yet.
   */
  waitingOn = $state.raw<string[] | null>(null);
  /** The last poll didn't reach the server. */
  offline = $state(false);
  /** The session's filters, described; the host can change them. */
  filters = $state("");

  // What the server last said about undo; unsent answers add to it.
  #serverCanUndo = $state(false);
  readonly #participationId: string;
  // Plain fields: nothing on screen reads them directly.
  #saves: Save[] = [];
  #sending = false;
  #whenIdle: (() => void)[] = [];
  #undoId: string | null = null;
  #fingerprint: string;
  #updates: WatchSessionSubscription | null = null;

  constructor(participationId: string, state: DeckState) {
    this.#participationId = participationId;
    this.cards = state.cards;
    this.matchCount = state.matchCount;
    this.#serverCanUndo = state.canUndo;
    this.waitingOn = state.waitingOn;
    this.filters = state.filters;
    this.#fingerprint = state.fingerprint;
  }

  /**
   * Starts following other people's changes; returns the function that
   * stops. `onEnded` runs when the session ends or you're no longer in it.
   */
  connect(watchSessionId: string, onEnded: () => void): () => void {
    const updates = subscribeToWatchSession(watchSessionId, {
      fingerprint: this.#fingerprint,
      query: () => ({
        participationId: this.#participationId,
        ...this.#held(),
      }),
      onChange: (reply) => {
        if (reply.status === "changed") this.#apply(reply.state);
        else onEnded();
      },
      onConnection: (ok) => {
        this.offline = !ok;
      },
    });
    this.#updates = updates;
    return () => {
      updates.stop();
      this.#updates = null;
    };
  }

  get card(): MovieCard | undefined {
    return this.cards[0];
  }

  get canUndo(): boolean {
    return this.#serverCanUndo || this.pending > 0;
  }

  /** Nothing left to deal for these filters, and nothing still saving. */
  get exhausted(): boolean {
    return this.cards.length === 0 && this.pending === 0 && !this.saving;
  }

  answer(answer: Answer): void {
    const card = this.cards[0];
    if (card === undefined || this.undoing || this.refused !== null) return;
    this.lastAnswer = answer;
    this.cards = this.cards.slice(1);
    this.#saves.push({ actionId: crypto.randomUUID(), card, answer });
    this.pending = this.#saves.length;
    void this.#send();
  }

  /**
   * Waits for the answers on their way to the server. True once every one
   * is saved; false if one failed (it waits for Retry) or the session
   * refused it.
   */
  async settle(): Promise<boolean> {
    await this.#idle();
    return this.pending === 0 && !this.#stopped();
  }

  retry(): void {
    void this.#send();
  }

  async undo(): Promise<void> {
    if (this.undoing || this.refused !== null || this.error !== null) return;
    this.undoError = null;

    // Answers still waiting to be sent: take the latest back right here.
    const unsent = this.#saves.length - (this.#sending ? 1 : 0);
    const latest = this.#saves.at(-1);
    if (unsent > 0 && latest !== undefined) {
      this.#saves.pop();
      this.pending = this.#saves.length;
      this.#showFirst(latest.card);
      return;
    }

    this.undoing = true;
    const release = this.#updates?.hold();
    try {
      // The save in flight must land first, or the server would undo the
      // answer before it.
      await this.#idle();
      if (this.#stopped()) return;
      this.#undoId ??= crypto.randomUUID();
      const result = await postUndo({
        actionId: this.#undoId,
        participationId: this.#participationId,
      });
      if (result === null || result.type === "error") {
        // Unknown outcome: keep the ID, so trying again can't undo twice.
        this.undoError = UNDO_FAILED;
        return;
      }
      this.#undoId = null;
      if (result.type === "failure") {
        if (result.data?.code === "nothing_to_undo") {
          this.#serverCanUndo = false;
        } else {
          this.refused = result.data?.message ?? UNDO_FAILED;
        }
        return;
      }
      if (result.type !== "success" || result.data === undefined) return;
      const { card, matchCount, canUndo } = result.data;
      if (card !== null) this.#showFirst(card);
      this.matchCount = matchCount;
      this.#serverCanUndo = canUndo;
    } finally {
      this.undoing = false;
      release?.();
    }
  }

  // Sends waiting answers one at a time until none are left or one fails.
  async #send(): Promise<void> {
    if (this.#sending) return;
    this.#sending = true;
    this.saving = true;
    this.error = null;
    const release = this.#updates?.hold();
    try {
      for (
        let save = this.#saves[0];
        save !== undefined;
        save = this.#saves[0]
      ) {
        const result = await postAnswer({
          actionId: save.actionId,
          participationId: this.#participationId,
          movieId: String(save.card.id),
          answer: save.answer,
          ...this.#held(),
        });
        // No answer from the server: the save may have gone through, so it
        // stays first in line with its ID, for `retry()`.
        if (result === null || result.type === "error") {
          this.error = SAVE_FAILED;
          return;
        }
        this.#saves.shift();
        this.pending = this.#saves.length;
        if (result.type === "failure") {
          // A movie that left the catalog is just skipped; anything else
          // (the session ended, you were removed) stops the deck.
          if (result.data?.code === "movie_not_found") continue;
          this.refused = result.data?.message ?? SAVE_FAILED;
          this.#saves = [];
          this.pending = 0;
          return;
        }
        if (result.type === "success" && result.data !== undefined) {
          this.#apply(result.data);
        }
      }
    } finally {
      this.#sending = false;
      this.saving = false;
      release?.();
      for (const resolve of this.#whenIdle.splice(0)) resolve();
    }
  }

  // What the deck holds, for the server: the card on screen and the answers
  // still waiting, which the next deal must skip.
  #held(): { exclude: string } {
    const visible = this.card;
    return {
      exclude: [
        ...(visible === undefined ? [] : [visible.id]),
        ...this.#saves.map((waiting) => waiting.card.id),
      ].join(","),
    };
  }

  // A save's or poll's reply: fresh cards replace the queue behind the
  // visible card, skipping anything answered since the request went out.
  // The visible card always stays.
  #apply(state: DeckState): void {
    const { cards, matchCount, canUndo, waitingOn, fingerprint } = state;
    this.#fingerprint = fingerprint;
    this.#updates?.saw(fingerprint);
    const answered = this.#saves.map((save) => save.card.id);
    const visible = this.card;
    const fresh = cards.filter(
      (card) => !answered.includes(card.id) && card.id !== visible?.id
    );
    this.cards = visible === undefined ? fresh : [visible, ...fresh];
    this.waitingOn = waitingOn;
    this.filters = state.filters;
    if (this.matchCount < REVIEW_PROMPT_AT && matchCount >= REVIEW_PROMPT_AT) {
      this.reviewPrompt = true;
    }
    this.matchCount = matchCount;
    this.#serverCanUndo = canUndo;
  }

  #showFirst(card: MovieCard): void {
    this.cards = [card, ...this.cards.filter((other) => other.id !== card.id)];
  }

  // A failed save or a refused change; read through a method because an
  // `await` may have changed them since the last check.
  #stopped(): boolean {
    return this.error !== null || this.refused !== null;
  }

  #idle(): Promise<void> {
    if (!this.#sending) return Promise.resolve();
    return new Promise((resolve) => this.#whenIdle.push(resolve));
  }
}

/**
 * Posts to one of this page's form actions, the way `use:enhance` does, and
 * reads Kit's reply. Null when the request never got an answer (offline,
 * dropped connection, an unreadable reply).
 */
async function post(
  action: "answer" | "undo",
  fields: Record<string, string>
): Promise<ActionResult | null> {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  try {
    // A relative URL: the action on the current page.
    const response = await fetch(`?/${action}`, {
      method: "POST",
      body,
      headers: { "x-sveltekit-action": "true" },
    });
    return deserialize(await response.text());
  } catch {
    return null;
  }
}

// Kit can't type a reply read by hand; these name what each action in
// +page.server.ts returns (its success value, or a watchRefusal failure).
function postAnswer(fields: Record<string, string>) {
  return post("answer", fields) as Promise<ActionResult<
    Plain<DeckState>,
    Plain<Refusal>
  > | null>;
}

function postUndo(fields: Record<string, string>) {
  return post("undo", fields) as Promise<ActionResult<
    Plain<UndoReply>,
    Plain<Refusal>
  > | null>;
}
