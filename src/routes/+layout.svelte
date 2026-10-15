<script lang="ts">
  import favicon from "#lib/assets/favicon.svg";

  import "./layout.css";
  import { applyTheme, setTheme, Theme } from "#lib/theme.svelte.ts";

  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // One theme for the page, handed to any component below through context
  // (like a React context provider or an Angular service provided here).
  // Starts from the first load's cookie on purpose: after that, picks
  // change it, and later loads only echo what the browser already knows.
  // svelte-ignore state_referenced_locally
  const theme = new Theme(data.themeChoice);
  setTheme(theme);
  // Listens while the app runs; the effect's cleanup closes the channel.
  $effect(() => theme.followOtherTabs());

  // <html> is outside Svelte's tree, so an effect keeps it in step: after a
  // pick, a pick in another tab, or the device switching while on System.
  // The script in app.html already did the first paint.
  $effect(() => {
    applyTheme(theme.dark);
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <meta name="application-name" content="Vunu" />
  <meta
    name="description"
    content="Find movies nobody in your group has seen."
  />
</svelte:head>
{@render children()}
