<script lang="ts">
  import type { ResolvedPathname } from "$app/types";
  import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import type { Snippet } from "svelte";

  import { Button } from "#lib/components/ui/button/index.ts";

  interface Props {
    title: string;
    /** One line under the title. */
    description?: string;
    /** Where the back link goes, like an iOS navigation bar's back button. */
    back?: { href: ResolvedPathname; label: string };
    children: Snippet;
  }

  let { title, description, back, children }: Props = $props();
</script>

<!-- The page draws edge to edge (viewport-fit=cover in app.html), so padding
     keeps content clear of the notch, rounded corners, and home indicator. -->
<main
  class="mx-auto w-full max-w-xl pt-[max(env(safe-area-inset-top),1.5rem)] pr-[max(env(safe-area-inset-right),1.25rem)] pb-[max(env(safe-area-inset-bottom),2.5rem)] pl-[max(env(safe-area-inset-left),1.25rem)]"
>
  {#if back}
    <!-- Pulled left so the chevron lines up with the title below it. -->
    <Button href={back.href} variant="ghost" size="sm" class="-ml-3">
      <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
      {back.label}
    </Button>
  {/if}
  <header class={[back ? "mt-3" : "mt-6", "mb-8"]}>
    <h1 class="text-3xl font-bold tracking-tight break-words">{title}</h1>
    {#if description}
      <p class="mt-2 text-muted-foreground">{description}</p>
    {/if}
  </header>
  {@render children()}
</main>
