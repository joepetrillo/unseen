<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";
  import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import ListGroup from "#lib/components/ListGroup.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Badge } from "#lib/components/ui/badge/index.ts";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.ts";
  import * as Item from "#lib/components/ui/item/index.ts";

  import InviteCard from "../InviteCard.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let group = $derived(data.group);
  let isOwner = $derived(group.me.role === "owner");

  const remove = new ActionForm({
    scope: () => group.id,
    confirm: (formData) => {
      const member = group.members.find(
        (m) => m.userId === formData.get("memberId")
      );
      return `Remove ${member?.nickname ?? "this person"} from ${group.name}? They can rejoin with the invite.`;
    },
  });
</script>

<svelte:head><title>Members · {group.name} · Vunu</title></svelte:head>

<Page
  title="Members"
  back={{
    href: resolve("/groups/[groupId]", { groupId: group.id }),
    label: group.name,
  }}
>
  <section aria-label="Members">
    <ListGroup>
      {#each group.members as member (member.userId)}
        <li>
          <Item.Root class="flex-nowrap rounded-none">
            <Item.Content class="min-w-0">
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
              <Item.Actions class="-my-2 -mr-2">
                <!-- The menu is drawn elsewhere in the page (a portal), so
                     its item submits this form through the `form` attribute. -->
                <form
                  id={`remove-${member.userId}`}
                  method="POST"
                  action="?/removeMember"
                  use:enhance={remove.submit}
                >
                  <input type="hidden" name="memberId" value={member.userId} />
                </form>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet child({ props })}
                      <Button
                        {...props}
                        variant="ghost"
                        size="icon"
                        aria-label={`More for ${member.nickname}`}
                      >
                        <HugeiconsIcon icon={MoreHorizontalIcon} />
                      </Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" class="w-auto">
                    <DropdownMenu.Item
                      class="w-full text-base"
                      variant="destructive"
                      disabled={remove.saving}
                    >
                      {#snippet child({ props })}
                        <button
                          {...props}
                          type="submit"
                          form={`remove-${member.userId}`}
                        >
                          Remove from group
                        </button>
                      {/snippet}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
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

  <div class="mt-10">
    <InviteCard
      groupId={group.id}
      groupName={group.name}
      code={group.inviteCode}
      url={data.inviteUrl}
      {isOwner}
    />
  </div>
</Page>
