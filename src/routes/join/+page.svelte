<script lang="ts">
  import { resolve } from "$app/paths";

  import JoinCodeForm from "#lib/components/JoinCodeForm.svelte";
  import Page from "#lib/components/Page.svelte";

  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<svelte:head><title>Join a group · Vunu</title></svelte:head>

<!-- A dead invite link (join/[code]) shows this same screen with its error. -->
<Page
  title="Join a group"
  description="Ask someone in the group for its invite code or link."
  back={{ href: resolve("/"), label: "Home" }}
>
  <JoinCodeForm error={form?.codeError} />
</Page>
