<script lang="ts">
  interface Props {
    posterPath: string | null;
    title: string;
    /**
     * How wide the poster is displayed, as an HTML `sizes` value ("48px").
     * The browser uses it to download the smallest image that looks sharp.
     */
    sizes: string;
  }

  let { posterPath, title, sizes }: Props = $props();

  // Widths TMDB's image CDN serves posters at. We only store the path.
  const WIDTHS = [92, 154, 342, 500, 780];

  function posterUrl(path: string, width: number): string {
    return `https://image.tmdb.org/t/p/w${String(width)}${path}`;
  }

  let srcset = $derived(
    posterPath === null
      ? null
      : WIDTHS.map((w) => `${posterUrl(posterPath, w)} ${String(w)}w`).join(
          ", "
        )
  );
</script>

{#if posterPath !== null}
  <!-- `src` is for browsers that ignore srcset. -->
  <img
    src={posterUrl(posterPath, 342)}
    {srcset}
    {sizes}
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
    class="flex aspect-2/3 w-full items-center justify-center rounded-md bg-neutral-200 p-1 text-center text-xs text-neutral-500"
  >
    No poster
  </div>
{/if}
