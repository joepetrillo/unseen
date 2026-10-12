<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { Input } from "#lib/components/ui/input/index.ts";
  import { GROUP_NAME_MAX, NICKNAME_MAX } from "#lib/group-fields.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // The browser names the new group, so a retry lands on the same one.
  const create = new ActionForm({ newIds: ["groupId"] });
</script>

<svelte:head><title>New group · Vunu</title></svelte:head>

<Page title="New group" back={{ href: resolve("/"), label: "Home" }}>
  <form method="POST" use:enhance={create.submit}>
    <Field.Group>
      <Field.Field>
        <Field.Label for="group-name">Group name</Field.Label>
        <Input
          id="group-name"
          name="name"
          required
          maxlength={GROUP_NAME_MAX}
          autocomplete="off"
          placeholder="Friday movie night"
        />
      </Field.Field>
      <Field.Field>
        <Field.Label for="nickname"
          >What should this group call you?</Field.Label
        >
        <Input
          id="nickname"
          name="nickname"
          value={data.nickname}
          required
          maxlength={NICKNAME_MAX}
          autocomplete="nickname"
        />
        <Field.Description>
          Only people in this group see it. You can change it later.
        </Field.Description>
      </Field.Field>
      <Button type="submit" size="lg" disabled={create.saving}>
        {create.saving ? "Creating…" : "Create group"}
      </Button>
      {#if create.error}
        <Field.Error>{create.error}</Field.Error>
      {/if}
    </Field.Group>
  </form>
</Page>
