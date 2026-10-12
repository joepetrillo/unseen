<script lang="ts">
  import { refreshAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
  import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
  import Film01Icon from "@hugeicons/core-free-icons/Film01Icon";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { authClient } from "#lib/auth-client.ts";
  import JoinCodeForm from "#lib/components/JoinCodeForm.svelte";
  import ListGroup from "#lib/components/ListGroup.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Item from "#lib/components/ui/item/index.ts";

  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let signingOut = $state(false);
  let errorMessage = $state<string | null>(null);

  async function signOut() {
    if (signingOut) return;
    signingOut = true;
    errorMessage = null;
    try {
      const { error } = await authClient.signOut();
      if (error !== null) {
        errorMessage = "Couldn't sign out. Try again.";
        return;
      }
      // The cookie is gone; the hook redirects when page data refreshes.
      try {
        await refreshAll();
      } catch {
        errorMessage =
          "Signed out, but couldn't refresh the page. Reload to continue.";
      }
    } catch {
      errorMessage =
        "Couldn't reach Vunu. Check your connection and try again.";
    } finally {
      signingOut = false;
    }
  }
</script>

<svelte:head><title>Vunu</title></svelte:head>

<Page title="Vunu" description="Find movies nobody in your group has seen.">
  <section aria-labelledby="groups-heading">
    <div class="mb-3 flex items-center justify-between gap-4">
      <h2 id="groups-heading" class="text-xl font-semibold">Your groups</h2>
      <Button href={resolve("/groups/new")} variant="secondary" size="sm">
        <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
        New group
      </Button>
    </div>
    {#if data.groups.length === 0}
      <p class="text-muted-foreground">
        You're not in a group yet. Start one, or join with an invite.
      </p>
    {:else}
      <ListGroup>
        {#each data.groups as group (group.id)}
          <li>
            <Item.Root class="rounded-none">
              {#snippet child({ props })}
                <a
                  href={resolve("/groups/[groupId]", { groupId: group.id })}
                  {...props}
                >
                  <Item.Content>
                    <Item.Title class="break-words">{group.name}</Item.Title>
                    <Item.Description>
                      {group.memberCount === 1
                        ? "1 person"
                        : `${String(group.memberCount)} people`}
                      {#if group.role === "owner"}· Owner{/if}
                    </Item.Description>
                  </Item.Content>
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    class="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </a>
              {/snippet}
            </Item.Root>
          </li>
        {/each}
      </ListGroup>
    {/if}

    <div class="mt-6">
      <JoinCodeForm error={form?.codeError} />
    </div>
  </section>

  <section class="mt-10" aria-labelledby="you-heading">
    <h2 id="you-heading" class="mb-3 text-xl font-semibold">You</h2>
    <ListGroup>
      <li>
        <Item.Root class="rounded-none">
          {#snippet child({ props })}
            <a href={resolve("seen")} {...props}>
              <Item.Media>
                <HugeiconsIcon icon={Film01Icon} class="size-5" />
              </Item.Media>
              <Item.Content>
                <Item.Title>Your seen movies</Item.Title>
              </Item.Content>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                class="size-5 text-muted-foreground"
                aria-hidden="true"
              />
            </a>
          {/snippet}
        </Item.Root>
      </li>
    </ListGroup>
    {#if data.user}
      <div class="mt-6 flex flex-col items-start gap-2">
        <p class="text-sm break-all text-muted-foreground">
          Signed in as {data.user.email}
        </p>
        <Button
          variant="outline"
          size="sm"
          onclick={signOut}
          disabled={signingOut}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    {/if}
    {#if errorMessage}
      <p class="mt-4 text-sm text-destructive" role="alert">{errorMessage}</p>
    {/if}
  </section>
</Page>
