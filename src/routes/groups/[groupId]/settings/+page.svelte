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

  let group = $derived(data.group);
  let isOwner = $derived(group.me.role === "owner");
  // Members are ordered by when they joined, so this is who'd take over.
  let nextOwner = $derived(
    group.members.find((member) => member.userId !== group.me.userId)
  );

  // The page component is reused if the URL moves to another group, so tie
  // each form's pending action ID to this group.
  const scope = () => group.id;
  const nickname = new ActionForm({ scope });
  const rename = new ActionForm({ scope });
  const leave = new ActionForm({
    scope,
    confirm: () =>
      nextOwner === undefined
        ? `Leave ${group.name}? You're the last one in it, so the group will be deleted.`
        : isOwner
          ? `Leave ${group.name}? ${nextOwner.nickname} will become the owner.`
          : `Leave ${group.name}?`,
  });
  const deletion = new ActionForm({
    scope,
    confirm: () => `Delete ${group.name} for everyone? This can't be undone.`,
  });
</script>

<svelte:head><title>Settings · {group.name} · Vunu</title></svelte:head>

<Page
  title="Settings"
  back={{
    href: resolve("/groups/[groupId]", { groupId: group.id }),
    label: group.name,
  }}
>
  <Field.Group>
    <form method="POST" action="?/nickname" use:enhance={nickname.submit}>
      <Field.Field>
        <Field.Label for="nickname">Your name in this group</Field.Label>
        <div class="flex gap-3">
          <Input
            id="nickname"
            name="nickname"
            value={group.me.nickname}
            required
            maxlength={NICKNAME_MAX}
            autocomplete="nickname"
          />
          <Button type="submit" variant="secondary" disabled={nickname.saving}>
            {nickname.saving ? "Saving…" : "Save"}
          </Button>
        </div>
        {#if nickname.error}
          <Field.Error>{nickname.error}</Field.Error>
        {/if}
      </Field.Field>
    </form>

    {#if isOwner}
      <form method="POST" action="?/rename" use:enhance={rename.submit}>
        <Field.Field>
          <Field.Label for="group-name">Group name</Field.Label>
          <div class="flex gap-3">
            <Input
              id="group-name"
              name="name"
              value={group.name}
              required
              maxlength={GROUP_NAME_MAX}
              autocomplete="off"
            />
            <Button type="submit" variant="secondary" disabled={rename.saving}>
              {rename.saving ? "Saving…" : "Rename"}
            </Button>
          </div>
          {#if rename.error}
            <Field.Error>{rename.error}</Field.Error>
          {/if}
        </Field.Field>
      </form>
    {/if}
  </Field.Group>

  <!-- Leaving and deleting sit apart from the everyday settings. -->
  <section class="mt-12" aria-labelledby="leave-heading">
    <h2 id="leave-heading" class="text-xl font-semibold">
      {isOwner ? "Leave or delete" : "Leave"}
    </h2>
    <p class="mt-1 mb-4 text-balance text-muted-foreground">
      {#if nextOwner === undefined}
        You're the only one here, so leaving deletes the group.
      {:else if isOwner}
        If you leave, {nextOwner.nickname} becomes the owner. Deleting removes the
        group for everyone.
      {:else}
        You can rejoin later with an invite.
      {/if}
    </p>
    <div class="flex flex-wrap gap-3">
      <form method="POST" action="?/leave" use:enhance={leave.submit}>
        <Button type="submit" variant="outline" disabled={leave.saving}>
          {leave.saving ? "Leaving…" : "Leave group"}
        </Button>
      </form>
      {#if isOwner}
        <form method="POST" action="?/delete" use:enhance={deletion.submit}>
          <Button
            type="submit"
            variant="destructive"
            disabled={deletion.saving}
          >
            {deletion.saving ? "Deleting…" : "Delete group"}
          </Button>
        </form>
      {/if}
    </div>
    {#if leave.error ?? deletion.error}
      <p class="mt-3 text-sm text-destructive" role="alert">
        {leave.error ?? deletion.error}
      </p>
    {/if}
  </section>
</Page>
