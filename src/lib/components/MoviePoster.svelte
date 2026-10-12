<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  import { cn } from "#lib/utils.ts";

  interface Props {
    posterPath: string | null;
    title: string;
    /**
     * How wide the poster is displayed, as an HTML `sizes` value ("48px").
     * The browser uses it to download the smallest image that looks sharp.
     */
    sizes: string;
    /** "eager" for posters on screen right away, like the deck's cards. */
    loading?: "lazy" | "eager";
    class?: ClassValue;
  }

  let {
    posterPath,
    title,
    sizes,
    loading = "lazy",
    class: className,
  }: Props = $props();

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
    {loading}
    width="342"
    height="513"
    class={cn("aspect-2/3 w-full rounded-lg bg-muted object-cover", className)}
  />
{:else}
  <div
    role="img"
    aria-label="No poster for {title}"
    class={cn(
      "flex aspect-2/3 w-full items-center justify-center rounded-lg bg-muted p-1 text-center text-xs text-muted-foreground",
      className
    )}
  >
    No poster
  </div>
{/if}
