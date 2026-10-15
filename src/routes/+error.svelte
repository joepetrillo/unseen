<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";

  import Page from "#lib/components/Page.svelte";

  // Not the error's own message: a 404 for a group you aren't in must read
  // the same as one for a group that doesn't exist, and 500s say "Internal
  // Error", which tells nobody what to do.
  let notFound = $derived(page.status === 404);
  let title = $derived(notFound ? "Not found" : "Something went wrong");
</script>

<svelte:head><title>{title} · Vunu</title></svelte:head>

<!-- Shown in place of any page whose load fails, inside the root layout. -->
<Page
  {title}
  description={notFound
    ? "This page doesn't exist, or you don't have access to it."
    : "Vunu couldn't load this page. Try again in a moment."}
  back={{ href: resolve("/"), label: "Home" }}
>
  {#if !notFound}
    <p class="text-sm text-muted-foreground">Error {page.status}</p>
  {/if}
</Page>
