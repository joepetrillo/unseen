<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import ListGroup from "#lib/components/ListGroup.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Badge } from "#lib/components/ui/badge/index.ts";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { Input } from "#lib/components/ui/input/index.ts";
  import * as Item from "#lib/components/ui/item/index.ts";
  import { GROUP_NAME_MAX, NICKNAME_MAX } from "#lib/group-fields.ts";

  import type { PageProps } from "./$types";
  import InviteCard from "./InviteCard.svelte";

  let { data }: PageProps = $props();

  let group = $derived(data.group);
  let isOwner = $derived(group.me.role === "owner");
  // Members are ordered by when they joined, so this is who'd take over.
  let nextOwner = $derived(
    group.members.find((member) => member.userId !== group.me.userId)
  );

  function nicknameOf(userId: FormDataEntryValue | null): string {
    return (
      group.members.find((member) => member.userId === userId)?.nickname ??
      "this person"
    );
  }

  // The page component is reused if the URL moves to another group, so tie
  // each form's pending action ID to this group.
  const scope = () => group.id;
  const rename = new ActionForm({ scope });
  const nickname = new ActionForm({ scope });
  const remove = new ActionForm({
    scope,
    confirm: (formData) =>
      `Remove ${nicknameOf(formData.get("memberId"))} from ${group.name}? They can rejoin with the invite.`,
  });
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

<svelte:head><title>{group.name} · Vunu</title></svelte:head>

<Page title={group.name} back={{ href: resolve("/"), label: "Home" }}>
  <InviteCard
    groupId={group.id}
    groupName={group.name}
    code={group.inviteCode}
    url={data.inviteUrl}
    {isOwner}
  />

  <section class="mt-10" aria-labelledby="members-heading">
    <h2 id="members-heading" class="mb-3 text-xl font-semibold">
      Members ({group.members.length})
    </h2>
    <ListGroup>
      {#each group.members as member (member.userId)}
        <li>
          <Item.Root class="rounded-none">
            <Item.Content>
              <Item.Title class="line-clamp-none break-words">
                {member.nickname}
                {#if member.userId === group.me.userId}
                  <span class="font-normal text-muted-foreground">(you)</span>
                {/if}
                {#if member.role === "owner"}
                  <Badge variant="secondary">Owner</Badge>
                {/if}
              </Item.Title>
            </Item.Content>
            {#if isOwner && member.userId !== group.me.userId}
              <Item.Actions>
                <form
                  method="POST"
                  action="?/removeMember"
                  use:enhance={remove.submit}
                >
                  <input type="hidden" name="memberId" value={member.userId} />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={remove.saving}
                    aria-label={`Remove ${member.nickname}`}
                  >
                    Remove
                  </Button>
                </form>
              </Item.Actions>
            {/if}
          </Item.Root>
        </li>
      {/each}
    </ListGroup>
    {#if remove.error}
      <p class="mt-3 text-sm text-destructive" role="alert">{remove.error}</p>
    {/if}
  </section>

  <section class="mt-10" aria-labelledby="settings-heading">
    <h2 id="settings-heading" class="mb-3 text-xl font-semibold">Settings</h2>

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
            <Button
              type="submit"
              variant="secondary"
              disabled={nickname.saving}
            >
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
              <Button
                type="submit"
                variant="secondary"
                disabled={rename.saving}
              >
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

    <div class="mt-8 flex flex-wrap gap-3">
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
    {#if leave.error}
      <p class="mt-3 text-sm text-destructive" role="alert">{leave.error}</p>
    {/if}
    {#if deletion.error}
      <p class="mt-3 text-sm text-destructive" role="alert">
        {deletion.error}
      </p>
    {/if}
  </section>
</Page>
