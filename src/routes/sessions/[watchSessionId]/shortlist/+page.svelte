<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";

  import MatchList from "../MatchList.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // One form per row, one save at a time; the movie is part of each input,
  // so every row's correction gets its own action ID.
  const correction = new ActionForm({ scope: () => data.session.id });
</script>

<svelte:head><title>Matches · Vunu</title></svelte:head>

<!-- No link preloading: a correction here changes the deck's counts. -->
<div data-sveltekit-preload-data="off" class="contents">
  <Page
    title="Matches"
    description="Nobody here has seen these. Pick one together."
    back={{
      href: resolve("/sessions/[watchSessionId]", {
        watchSessionId: data.session.id,
      }),
      label: data.session.closed ? "Session" : "Keep going",
    }}
  >
    {#if data.matches.length === 0}
      <p class="text-muted-foreground">
        No matches yet. Every movie you answer Not seen shows up here.
      </p>
    {:else}
      {#snippet correct(movie: { id: number; title: string })}
        {#if data.participationId !== null}
          <form method="POST" action="?/seen" use:enhance={correction.submit}>
            <input
              type="hidden"
              name="participationId"
              value={data.participationId}
            />
            <input type="hidden" name="movieId" value={movie.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={correction.saving}
              aria-label={`Actually, I've seen ${movie.title}`}
            >
              Actually, I've seen this
            </Button>
          </form>
        {/if}
      {/snippet}
      <MatchList matches={data.matches} actions={correct} />
      {#if correction.error}
        <p class="mt-3 text-sm text-destructive" role="alert">
          {correction.error}
        </p>
      {/if}
    {/if}
  </Page>
</div>
