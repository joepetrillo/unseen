<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import FilterFields from "#lib/components/FilterFields.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let sessionHref = $derived(
    resolve("/sessions/[watchSessionId]", { watchSessionId: data.session.id })
  );
  const change = new ActionForm({ scope: () => data.session.id });
</script>

<svelte:head><title>Change filters · Vunu</title></svelte:head>

<Page
  title="Change filters"
  description="Your matches and answers stay. The new filters pick the movies that come next, for everyone in the session."
  back={{ href: sessionHref, label: "Session" }}
>
  <form method="POST" action="?/change" use:enhance={change.submit}>
    <Field.Group>
      <FilterFields genres={data.genres} initial={data.filters} />
    </Field.Group>

    <Button
      type="submit"
      size="lg"
      class="mt-8 w-full"
      disabled={change.saving}
    >
      {change.saving ? "Saving…" : "Save filters"}
    </Button>
    {#if change.error}
      <p class="mt-3 text-sm text-destructive" role="alert">
        {change.error}
      </p>
    {/if}
  </form>
</Page>
