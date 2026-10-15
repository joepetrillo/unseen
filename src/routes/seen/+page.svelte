<script lang="ts">
  import { resolve } from "$app/paths";

  import ListGroup from "#lib/components/ListGroup.svelte";
  import MoviePoster from "#lib/components/MoviePoster.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import { Input } from "#lib/components/ui/input/index.ts";
  import * as Item from "#lib/components/ui/item/index.ts";
  import { NativeSelect } from "#lib/components/ui/native-select/index.ts";
  import { dropEmptyFields } from "#lib/drop-empty-fields.ts";
  import { formatCount, joinDetails } from "#lib/format.ts";

  import type { PageProps } from "./$types";
  import SeenButton from "./SeenButton.svelte";

  let { data }: PageProps = $props();

  // A link to this page with the current search, changed by `changes`. Every
  // change goes back to page 1 unless it sets the page, and default values are
  // left out to keep URLs short.
  function searchHref(changes: Partial<PageProps["data"]["search"]>) {
    const { scope, title, genre, decade, page } = {
      ...data.search,
      page: 1,
      ...changes,
    };
    const params: Record<string, string> = {};
    if (scope === "all") params.scope = scope;
    if (title !== "") params.title = title;
    if (genre !== undefined) params.genre = String(genre);
    if (decade !== undefined) params.decade = String(decade);
    if (page > 1) params.page = String(page);
    const query = new URLSearchParams(params).toString();
    // `resolve` accepts a query string, so links keep Kit's resolved-path type.
    return resolve(query === "" ? "seen" : `seen?${query}`);
  }

  let tabs = $derived([
    { scope: "mine", label: `Your list (${formatCount(data.seenCount)})` },
    { scope: "all", label: "All movies" },
  ] as const);

  let filtered = $derived(
    data.search.title !== "" ||
      data.search.genre !== undefined ||
      data.search.decade !== undefined
  );

  // Picking a genre or decade searches right away.
  function submitOnChange(event: Event & { currentTarget: HTMLSelectElement }) {
    event.currentTarget.form?.requestSubmit();
  }
</script>

<svelte:head><title>Seen movies · Vunu</title></svelte:head>

<Page
  title="Seen movies"
  description="Vunu never deals you a movie on your list."
  back={{ href: resolve("/"), label: "Home" }}
>
  <!-- Links styled like shadcn's Tabs: each tab is its own URL. -->
  <nav class="flex gap-1 rounded-4xl bg-muted p-1" aria-label="Lists">
    {#each tabs as tab (tab.scope)}
      <a
        class={[
          "flex-1 rounded-4xl px-4 py-2 text-center text-sm font-medium transition-colors",
          data.search.scope === tab.scope
            ? "bg-background shadow-sm dark:bg-input"
            : "text-muted-foreground",
        ]}
        href={searchHref({ scope: tab.scope })}
        aria-current={data.search.scope === tab.scope ? "page" : undefined}
      >
        {tab.label}
      </a>
    {/each}
  </nav>

  <!-- A GET form: submitting navigates to this page with the fields as URL
       search params, and the load function reruns with them. -->
  <form
    class="mt-6 flex flex-col gap-3"
    role="search"
    onformdata={dropEmptyFields}
  >
    {#if data.search.scope === "all"}
      <input type="hidden" name="scope" value="all" />
    {/if}
    <div class="flex flex-wrap gap-3">
      <Input
        class="min-w-40 flex-1"
        type="search"
        name="title"
        value={data.search.title}
        maxlength={100}
        placeholder="Search by title"
        enterkeyhint="search"
        aria-label="Title"
      />
      <Button type="submit" variant="secondary">Search</Button>
    </div>
    <!-- Side by side, or stacked when a narrow phone would cut off
         "Any decade". -->
    <div class="flex flex-wrap gap-3">
      <NativeSelect
        class="min-w-36 flex-1"
        name="genre"
        aria-label="Genre"
        onchange={submitOnChange}
      >
        <option value="">Any genre</option>
        {#each data.genres as genre (genre.id)}
          <option value={genre.id} selected={genre.id === data.search.genre}>
            {genre.name}
          </option>
        {/each}
      </NativeSelect>
      <NativeSelect
        class="min-w-36 flex-1"
        name="decade"
        aria-label="Decade"
        onchange={submitOnChange}
      >
        <option value="">Any decade</option>
        {#each data.decades as decade (decade)}
          <option value={decade} selected={decade === data.search.decade}>
            {decade}s
          </option>
        {/each}
      </NativeSelect>
    </div>
  </form>

  {#if data.movies.length > 0}
    <ListGroup class="mt-6">
      {#each data.movies as movie (movie.id)}
        <li>
          <Item.Root class="flex-nowrap rounded-none" size="sm">
            <Item.Media class="w-12 shrink-0">
              <MoviePoster
                posterPath={movie.posterPath}
                title={movie.title}
                sizes="48px"
              />
            </Item.Media>
            <Item.Content class="min-w-0">
              <Item.Title class="line-clamp-2" title={movie.title}
                >{movie.title}</Item.Title
              >
              <Item.Description>
                {joinDetails([
                  movie.year === null ? "Year unknown" : String(movie.year),
                  data.search.scope === "all" && movie.seen ? "Seen" : null,
                ])}
              </Item.Description>
            </Item.Content>
            <Item.Actions>
              <SeenButton
                movieId={movie.id}
                title={movie.title}
                seen={movie.seen}
              />
            </Item.Actions>
          </Item.Root>
        </li>
      {/each}
    </ListGroup>
  {:else if data.search.page > 1}
    <p class="mt-8 text-muted-foreground">No more movies.</p>
  {:else if filtered}
    <p class="mt-8 text-muted-foreground">
      No movies match.
      <a
        class="font-medium text-foreground underline underline-offset-4"
        href={searchHref({ title: "", genre: undefined, decade: undefined })}
      >
        Clear the search
      </a>
    </p>
  {:else if data.search.scope === "mine"}
    <p class="mt-8 text-muted-foreground">
      Nothing here yet. Find movies you've seen in
      <a
        class="font-medium text-foreground underline underline-offset-4"
        href={searchHref({ scope: "all" })}>All movies</a
      >.
    </p>
  {:else}
    <p class="mt-8 text-muted-foreground">The catalog is empty.</p>
  {/if}

  {#if data.search.page > 1 || data.hasNextPage}
    <nav class="mt-6 flex justify-between gap-3" aria-label="Pages">
      {#if data.search.page > 1}
        <Button
          href={searchHref({ page: data.search.page - 1 })}
          variant="outline"
        >
          Previous
        </Button>
      {:else}
        <span></span>
      {/if}
      {#if data.hasNextPage}
        <Button
          href={searchHref({ page: data.search.page + 1 })}
          variant="outline"
        >
          Next
        </Button>
      {/if}
    </nav>
  {/if}
</Page>
