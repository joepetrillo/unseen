<script lang="ts">
  interface Props {
    posterPath: string | null;
    title: string;
  }

  let { posterPath, title }: Props = $props();

  // Posters load straight from TMDB's image CDN; we only store the path.
  // w342 is sharp at card size without downloading the original.
  let src = $derived(
    posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : null
  );
</script>

{#if src}
  <img
    {src}
    alt="Poster for {title}"
    loading="lazy"
    width="342"
    height="513"
    class="aspect-2/3 w-full rounded-md bg-neutral-200 object-cover"
  />
{:else}
  <div
    role="img"
    aria-label="No poster for {title}"
    class="flex aspect-2/3 w-full items-center justify-center rounded-md bg-neutral-200 text-sm text-neutral-500"
  >
    No poster
  </div>
{/if}
