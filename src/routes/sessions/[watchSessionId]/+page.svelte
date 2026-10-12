<script lang="ts">
  import { enhance } from "$app/forms";
  import { beforeNavigate, goto, refreshAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { ResolvedPathname } from "$app/types";
  import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
  import Undo02Icon from "@hugeicons/core-free-icons/Undo02Icon";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { fly } from "svelte/transition";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import MoviePoster from "#lib/components/MoviePoster.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Badge } from "#lib/components/ui/badge/index.ts";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Card from "#lib/components/ui/card/index.ts";
  import { Spinner } from "#lib/components/ui/spinner/index.ts";
  import {
    formatRuntime,
    type MovieCard,
    REVIEW_PROMPT_AT,
  } from "#lib/watch-fields.ts";

  import type { PageProps } from "./$types";
  import { Deck } from "./deck.svelte.ts";
  import MatchList from "./MatchList.svelte";

  let { data }: PageProps = $props();

  // A new Deck whenever the page data changes (another session, or a reload
  // after the session ended); otherwise it lives as long as the page.
  let deck = $derived(
    data.view === "deck" ? new Deck(data.participationId, data.deck) : null
  );

  // Follow other people's answers while the deck is on screen. An effect is
  // the right tool here: polling is an outside process that must start with
  // the deck and stop when it goes (like useEffect's cleanup in React, or
  // ngOnDestroy). When the session ends for you, reload into the ended view.
  $effect(() => {
    if (deck === null) return;
    return deck.connect(data.session.id, () => void refreshAll());
  });

  let groupHref = $derived(
    resolve("/groups/[groupId]", { groupId: data.session.groupId })
  );
  let shortlistHref = $derived(
    resolve("/sessions/[watchSessionId]/shortlist", {
      watchSessionId: data.session.id,
    })
  );
  let changeFiltersHref = $derived(
    resolve("/sessions/[watchSessionId]/filters", {
      watchSessionId: data.session.id,
    })
  );

  // Leaving the page drops answers still waiting to be sent, so any link
  // (back, Matches, Change filters) waits for them first. A failed save
  // keeps you here with Retry. Closing the tab gets the browser's own
  // "Leave this page?" question instead.
  beforeNavigate((navigation) => {
    const target = navigation.to?.url;
    if (deck === null || deck.pending === 0 || target === undefined) return;
    navigation.cancel();
    if (navigation.willUnload) return;
    // The navigation Kit just resolved and we cancelled: same origin (an
    // unload would have returned above), so its path is already resolved.
    const href =
      `${target.pathname}${target.search}${target.hash}` as ResolvedPathname;
    const saving = deck;
    void saving.settle().then((saved) => {
      // refreshAll: Kit preloaded the link's data when it was touched,
      // before these saves landed; that copy would show stale matches.
      if (saved) void goto(href, { refreshAll: true });
    });
  });

  const join = new ActionForm({ scope: () => data.session.id });
  const end = new ActionForm({
    scope: () => data.session.id,
    confirm: () =>
      "End this session for everyone? Its matches stay on its page.",
  });

  // "Sam", "Sam and Alex", "Sam, Alex, and Jo".
  const names = new Intl.ListFormat("en", { type: "conjunction" });
  function listNames(people: string[]): string {
    return names.format(people);
  }

  function details(movie: MovieCard): string {
    return [
      movie.year === null ? null : String(movie.year),
      movie.runtime === null ? null : formatRuntime(movie.runtime),
      movie.genres.slice(0, 3).join(", ") || null,
    ]
      .filter((part) => part !== null)
      .join(" · ");
  }

  // The leaving card flies toward the side of its answer. Skipped for
  // people who ask their device for less motion.
  function leave(node: Element) {
    return fly(node, {
      x: deck?.lastAnswer === "seen" ? -360 : 360,
      duration: prefersReducedMotion.current ? 0 : 260,
    });
  }
</script>

<svelte:head><title>Find a movie · Vunu</title></svelte:head>

{#if deck !== null}
  <!-- A full-screen layout (not Page): the card takes whatever height the
       header and buttons leave. dvh follows Safari's toolbar as it hides. -->
  <!-- No link preloading: matches change with every answer, and data
       fetched when a link is touched could be stale by the time it opens. -->
  <div
    data-sveltekit-preload-data="off"
    class="mx-auto flex h-dvh w-full max-w-md flex-col pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),1.25rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1.25rem)]"
  >
    <header class="flex items-center justify-between gap-3">
      <Button href={groupHref} variant="ghost" size="sm" class="-ml-3 min-w-0">
        <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
        <span class="truncate">{data.session.groupName}</span>
      </Button>
      <Button href={shortlistHref} variant="secondary" size="sm">
        Matches
        <Badge>{deck.matchCount}</Badge>
      </Button>
    </header>
    <!-- From the deck: the host can change filters mid-session. -->
    <p class="mt-1 truncate text-sm text-muted-foreground">
      {deck.filters}
    </p>

    <main class="flex min-h-0 flex-1 flex-col items-center justify-center py-4">
      {#if deck.refused !== null}
        <div class="text-center" role="alert">
          <p class="text-lg font-semibold">{deck.refused}</p>
          <Button class="mt-4" onclick={() => refreshAll()}>Reload</Button>
        </div>
      {:else if deck.reviewPrompt}
        <Card.Root class="w-full">
          <Card.Header>
            <Card.Title>{REVIEW_PROMPT_AT} movies nobody has seen</Card.Title>
            <Card.Description>
              Take a look and pick one, or keep going to find more.
            </Card.Description>
          </Card.Header>
          <Card.Footer class="flex flex-col items-stretch gap-3">
            <Button size="lg" href={shortlistHref}>See the matches</Button>
            <Button variant="ghost" onclick={() => (deck.reviewPrompt = false)}>
              Keep going
            </Button>
          </Card.Footer>
        </Card.Root>
      {:else if deck.card !== undefined}
        <!-- The visible card with the next one behind it, slightly smaller,
             so its poster is already loaded when it moves up. -->
        <div class="relative aspect-2/3 h-full max-h-full max-w-full">
          {#each deck.cards.slice(0, 2).reverse() as card (card.id)}
            {@const isTop = card.id === deck.card.id}
            <div
              class={[
                "absolute inset-0 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
                isTop ? "z-10" : "translate-y-3 scale-[0.94] opacity-60",
              ]}
              aria-hidden={!isTop}
              out:leave
            >
              <MoviePoster
                posterPath={card.posterPath}
                title={card.title}
                sizes="(max-width: 640px) 80vw, 420px"
                loading="eager"
                class="h-full rounded-3xl shadow-xl"
              />
            </div>
          {/each}
        </div>
        <div class="mt-4 w-full text-center" aria-live="polite">
          <h1 class="line-clamp-2 text-2xl font-bold tracking-tight">
            {deck.card.title}
          </h1>
          <p class="mt-1 text-muted-foreground">{details(deck.card)}</p>
        </div>
      {:else if !deck.exhausted || deck.waitingOn === null}
        <div class="flex items-center gap-3 text-muted-foreground">
          <Spinner />
          Dealing more movies…
        </div>
      {:else if deck.waitingOn.length > 0}
        <!-- Never suggest other filters here: the movies exist, they just
             need other people's answers. -->
        <div class="text-center" aria-live="polite">
          <p class="text-lg font-semibold">You're caught up</p>
          <p class="mt-2 text-muted-foreground">
            Waiting for {listNames(deck.waitingOn)} to answer.
          </p>
          <div class="mt-6 flex flex-col gap-3">
            <Button size="lg" href={shortlistHref}>See the matches</Button>
          </div>
        </div>
      {:else}
        <div class="text-center">
          <p class="text-lg font-semibold">
            That's every movie that fits these filters.
          </p>
          <p class="mt-2 text-muted-foreground">
            {data.session.isHost
              ? "Look over the matches, or change the filters for more. The matches stay."
              : "Look over the matches. The host can change the filters for more."}
          </p>
          <div class="mt-6 flex flex-col gap-3">
            <Button size="lg" href={shortlistHref}>See the matches</Button>
            {#if data.session.isHost}
              <Button variant="ghost" href={changeFiltersHref}>
                Change filters
              </Button>
            {/if}
          </div>
        </div>
      {/if}
    </main>

    <footer class="flex flex-col gap-3">
      <div class="flex min-h-9 items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          class="-ml-3"
          onclick={() => {
            void deck.undo();
          }}
          disabled={!deck.canUndo ||
            deck.undoing ||
            deck.error !== null ||
            deck.refused !== null}
        >
          <HugeiconsIcon icon={Undo02Icon} data-icon="inline-start" />
          Undo
        </Button>
        <!-- Saving is quiet; only a failure asks for anything. -->
        <p class="text-sm text-muted-foreground" aria-live="polite">
          {#if deck.error !== null}
            <span class="text-destructive">{deck.error}</span>
          {:else if deck.undoError !== null}
            <span class="text-destructive">{deck.undoError}</span>
          {:else if deck.saving}
            Saving…
          {:else if deck.offline}
            Can't reach Vunu. Trying again…
          {/if}
        </p>
        {#if deck.error !== null}
          <Button
            variant="outline"
            size="sm"
            onclick={() => {
              deck.retry();
            }}
          >
            Retry
          </Button>
        {/if}
      </div>

      <!-- Two equal buttons: Vunu asks what you've seen, not what you like. -->
      <div class="grid grid-cols-2 gap-3">
        {#each [{ answer: "seen", label: "Seen" }, { answer: "not_seen", label: "Not seen" }] as const as choice (choice.answer)}
          <Button
            variant="secondary"
            class="h-16 text-lg"
            disabled={deck.card === undefined ||
              deck.undoing ||
              deck.reviewPrompt ||
              deck.refused !== null}
            onclick={() => {
              deck.answer(choice.answer);
            }}
          >
            {choice.label}
          </Button>
        {/each}
      </div>

      <!-- Host only: new filters change what everyone is dealt next. -->
      {#if data.session.isHost}
        <div class="flex items-center justify-center gap-2 text-sm">
          <Button variant="link" size="sm" href={changeFiltersHref}>
            Change filters
          </Button>
          <span class="text-muted-foreground" aria-hidden="true">·</span>
          <!-- Ending waits for every answer to be saved, or they'd miss the
               matches the end records (and then be refused). -->
          <form
            method="POST"
            action="?/end"
            use:enhance={(input) => {
              if (deck.pending > 0) {
                input.cancel();
                return;
              }
              return end.submit(input);
            }}
          >
            <Button
              type="submit"
              variant="link"
              size="sm"
              disabled={end.saving || deck.pending > 0}
            >
              {end.saving ? "Ending…" : "End session"}
            </Button>
          </form>
        </div>
      {/if}
      {#if end.error}
        <p class="text-center text-sm text-destructive" role="alert">
          {end.error}
        </p>
      {/if}
    </footer>
  </div>
{:else if data.view === "closed"}
  <Page
    title="This session has ended"
    description="These were the movies nobody had seen."
    back={{ href: groupHref, label: data.session.groupName }}
  >
    {#if data.matches.length > 0}
      <MatchList matches={data.matches} />
    {:else}
      <p class="text-muted-foreground">It ended without any matches.</p>
    {/if}
    <!-- The host may have started a new one ("Start a new one"). -->
    {#if data.current !== null}
      <Button
        class="mt-8 w-full"
        size="lg"
        href={resolve("/sessions/[watchSessionId]", {
          watchSessionId: data.current,
        })}
      >
        Go to the current session
      </Button>
    {:else}
      <Button
        class="mt-8 w-full"
        size="lg"
        href={resolve("/groups/[groupId]/find", {
          groupId: data.session.groupId,
        })}
      >
        Find a movie
      </Button>
    {/if}
  </Page>
{:else if data.view === "invited"}
  <Page
    title={data.host === null
      ? "Join this session?"
      : `${data.host} invited you`}
    description="Answer Seen or Not seen on your own phone. Anything nobody has seen becomes a match."
    back={{ href: groupHref, label: data.session.groupName }}
  >
    <Card.Root>
      <Card.Header>
        <Card.Title>Watching together</Card.Title>
        <Card.Description>{data.joined.join(", ")}</Card.Description>
      </Card.Header>
      <Card.Content>
        <p class="text-sm text-muted-foreground">{data.session.filters}</p>
      </Card.Content>
      <Card.Footer>
        <form
          class="w-full"
          method="POST"
          action="?/join"
          use:enhance={join.submit}
        >
          <input
            type="hidden"
            name="participationId"
            value={data.participationId}
          />
          <Button type="submit" size="lg" class="w-full" disabled={join.saving}>
            {join.saving ? "Joining…" : "Join"}
          </Button>
          {#if join.error}
            <p class="mt-3 text-sm text-destructive" role="alert">
              {join.error}
            </p>
          {/if}
        </form>
      </Card.Footer>
    </Card.Root>
  </Page>
{:else}
  <Page
    title="You're not in this session"
    back={{ href: groupHref, label: data.session.groupName }}
  >
    <p class="text-muted-foreground">
      It was started for other people in {data.session.groupName}.
    </p>
  </Page>
{/if}
