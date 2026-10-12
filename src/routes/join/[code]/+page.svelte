<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import JoinCodeForm from "#lib/components/JoinCodeForm.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { Input } from "#lib/components/ui/input/index.ts";
  import { NICKNAME_MAX } from "#lib/group-fields.ts";

  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const join = new ActionForm();
</script>

<svelte:head>
  <title>{data.found ? `Join ${data.group.name}` : "Join a group"} · Vunu</title
  >
</svelte:head>

{#if data.found}
  <Page
    title="Join {data.group.name}?"
    back={{ href: resolve("/"), label: "Home" }}
  >
    <form method="POST" action="?/join" use:enhance={join.submit}>
      <input type="hidden" name="groupId" value={data.group.id} />
      <Field.Group>
        <Field.Field>
          <Field.Label for="nickname">
            What should this group call you?
          </Field.Label>
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
        <Button type="submit" size="lg" disabled={join.saving}>
          {join.saving ? "Joining…" : "Join group"}
        </Button>
        {#if join.error}
          <Field.Error>{join.error}</Field.Error>
        {/if}
      </Field.Group>
    </form>
  </Page>
{:else}
  <!-- A wrong or reset code gets the same form as the home page, with
       the same message, so the person can try another code. -->
  <Page title="Join a group" back={{ href: resolve("/"), label: "Home" }}>
    <JoinCodeForm error={form?.codeError ?? data.message} />
  </Page>
{/if}
