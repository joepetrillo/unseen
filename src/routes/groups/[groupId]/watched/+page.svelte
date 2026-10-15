<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import ListGroup from "#lib/components/ListGroup.svelte";
  import MoviePoster from "#lib/components/MoviePoster.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Item from "#lib/components/ui/item/index.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const unwatched = new ActionForm({ scope: () => data.group.id });
</script>

<svelte:head><title>Watched · {data.group.name} · Vunu</title></svelte:head>

<Page
  title="Watched"
  description={data.watched.length === 0
    ? "Nothing yet. After movie night, open the match's menu and pick We watched this."
    : "Movies this group marked as watched. They won't come up again unless you remove them."}
  back={{
    href: resolve("/groups/[groupId]", { groupId: data.group.id }),
    label: data.group.name,
  }}
>
  {#if unwatched.error}
    <p class="mb-4 text-sm text-destructive" role="alert">
      {unwatched.error}
    </p>
  {/if}

  {#if data.watched.length > 0}
    <ListGroup>
      {#each data.watched as movie (movie.id)}
        <li>
          <Item.Root class="flex-nowrap rounded-none">
            <Item.Media class="w-12 shrink-0">
              <MoviePoster
                posterPath={movie.posterPath}
                title={movie.title}
                sizes="48px"
              />
            </Item.Media>
            <Item.Content class="min-w-0">
              <Item.Title class="line-clamp-2">{movie.title}</Item.Title>
              {#if movie.year !== null}
                <Item.Description>{movie.year}</Item.Description>
              {/if}
            </Item.Content>
            <Item.Actions>
              <form
                method="POST"
                action="?/unwatched"
                use:enhance={unwatched.submit}
              >
                <input type="hidden" name="movieId" value={movie.id} />
                <!-- Like the seen list's button: the label starts with the
                     visible word, so voice control finds it too. -->
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={unwatched.saving}
                  aria-label={`Remove ${movie.title}`}
                >
                  Remove
                </Button>
              </form>
            </Item.Actions>
          </Item.Root>
        </li>
      {/each}
    </ListGroup>
  {/if}
</Page>
