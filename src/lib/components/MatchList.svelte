<script lang="ts">
  import type { Snippet } from "svelte";

  import ListGroup from "#lib/components/ListGroup.svelte";
  import MoviePoster from "#lib/components/MoviePoster.svelte";
  import { buttonVariants } from "#lib/components/ui/button/index.ts";
  import * as Item from "#lib/components/ui/item/index.ts";
  import {
    formatRuntime,
    type MovieCard,
    whereToWatchUrl,
  } from "#lib/deck-fields.ts";

  interface Props {
    matches: MovieCard[];
    /**
     * Extra controls for each row ("We watched this"). A snippet
     * prop: like a React render prop, the parent decides the markup.
     */
    actions?: Snippet<[MovieCard]>;
  }

  let { matches, actions }: Props = $props();

  function details(movie: MovieCard): string {
    return [
      movie.year === null ? null : String(movie.year),
      movie.runtime === null ? null : formatRuntime(movie.runtime),
      movie.genres.slice(0, 3).join(", ") || null,
    ]
      .filter((part) => part !== null)
      .join(" · ");
  }
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
          <Item.Description>{details(movie)}</Item.Description>
          <div class="mt-1 flex flex-wrap gap-2">
            <!-- rel="external": a page outside Vunu, opened in a new tab. -->
            <a
              class={buttonVariants({ variant: "outline", size: "sm" })}
              href={whereToWatchUrl(movie.id)}
              target="_blank"
              rel="external noopener noreferrer"
            >
              Where to watch
            </a>
            {@render actions?.(movie)}
          </div>
        </Item.Content>
      </Item.Root>
    </li>
  {/each}
</ListGroup>
