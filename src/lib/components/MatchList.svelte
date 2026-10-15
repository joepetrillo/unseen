<script lang="ts">
  import type { Snippet } from "svelte";

  import ListGroup from "#lib/components/ListGroup.svelte";
  import MoviePoster from "#lib/components/MoviePoster.svelte";
  import { buttonVariants } from "#lib/components/ui/button/index.ts";
  import * as Item from "#lib/components/ui/item/index.ts";
  import {
    describeMovie,
    type MovieCard,
    whereToWatchUrl,
  } from "#lib/deck-fields.ts";

  interface Props {
    matches: MovieCard[];
    /**
     * Extra controls at the end of each row (a "More" menu). A snippet
     * prop: like a React render prop, the parent decides the markup.
     */
    actions?: Snippet<[MovieCard]>;
  }

  let { matches, actions }: Props = $props();
</script>

<ListGroup>
  {#each matches as movie (movie.id)}
    <li>
      <Item.Root class="flex-nowrap items-start rounded-none">
        <Item.Media class="w-16 shrink-0">
          <MoviePoster
            posterPath={movie.posterPath}
            title={movie.title}
            sizes="64px"
          />
        </Item.Media>
        <Item.Content class="min-w-0 gap-2">
          <Item.Title class="line-clamp-2">{movie.title}</Item.Title>
          <Item.Description>{describeMovie(movie)}</Item.Description>
          <div class="mt-1">
            <!-- rel="external": a page outside Vunu, opened in a new tab. -->
            <a
              class={buttonVariants({ variant: "outline", size: "sm" })}
              href={whereToWatchUrl(movie.id)}
              target="_blank"
              rel="external noopener noreferrer"
            >
              Where to watch
            </a>
          </div>
        </Item.Content>
        {#if actions}
          <Item.Actions class="-mr-2 self-start">
            {@render actions(movie)}
          </Item.Actions>
        {/if}
      </Item.Root>
    </li>
  {/each}
</ListGroup>
