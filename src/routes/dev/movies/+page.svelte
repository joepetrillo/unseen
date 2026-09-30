<script lang="ts">
  import MoviePoster from "#lib/components/MoviePoster.svelte";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head><title>Catalog (dev) · Unseen</title></svelte:head>

<main class="mx-auto max-w-6xl p-4">
  <h1 class="text-2xl font-bold">Catalog</h1>
  <p class="text-sm text-neutral-600">
    {data.movies.length} movies, most-voted first.
  </p>

  <ul class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
    {#each data.movies as movie (movie.id)}
      <li>
        <MoviePoster posterPath={movie.posterPath} title={movie.title} />
        <p class="mt-1 text-sm font-medium">{movie.title}</p>
        <p class="text-xs text-neutral-600">
          {movie.releaseDate?.slice(0, 4) ?? "Year unknown"}
          · {movie.genres.map((g) => g.name).join(", ")}
        </p>
      </li>
    {/each}
  </ul>
</main>
