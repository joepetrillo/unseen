<script lang="ts">
  import { resolve } from "$app/paths";

  import Page from "#lib/components/Page.svelte";
  import PreferenceFields from "#lib/components/PreferenceFields.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { preferencesToQuery } from "#lib/deck-fields.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let deckHref = $derived(
    resolve("/groups/[groupId]/find", { groupId: data.group.id })
  );
  let query = $derived(preferencesToQuery(data.preferences));
  // Back to the deck as it was, preferences included.
  let backHref = $derived(
    query === ""
      ? deckHref
      : resolve(`/groups/[groupId]/find?${query}` as const, {
          groupId: data.group.id,
        })
  );
</script>

<svelte:head><title>In the mood for · Vunu</title></svelte:head>

<Page
  title="In the mood for"
  description="Just for you, just for tonight. You'll also get movies your group has already started, so your answer can finish a match."
  back={{
    href: backHref,
    label: "Back to the deck",
  }}
>
  <!-- A GET form: submitting navigates to the deck with the fields in its
       URL query, like a search box. Kit turns it into a client-side
       navigation, so the deck's load runs with the new preferences. -->
  <form method="GET" action={deckHref}>
    <Field.Group>
      <PreferenceFields genres={data.genres} initial={data.preferences} />
    </Field.Group>
    <div class="mt-8 flex flex-col gap-3">
      <Button type="submit" size="lg">Show movies</Button>
      <Button variant="ghost" href={deckHref}>Anything is fine</Button>
    </div>
  </form>
</Page>
