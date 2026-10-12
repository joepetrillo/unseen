<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import FilterFields, { CHIP } from "#lib/components/FilterFields.svelte";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Card from "#lib/components/ui/card/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { NO_FILTERS } from "#lib/watch-fields.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Starting over keeps the current session's people ticked.
  let invitedUserIds = $derived([...data.invited]);
  // The browser names the new session, so a retried start lands on it.
  const start = new ActionForm({
    newIds: ["watchSessionId"],
    scope: () => data.group.id,
  });
</script>

<svelte:head><title>Find a movie · Vunu</title></svelte:head>

<Page
  title="Find a movie"
  description="One movie at a time: tap Seen or Not seen. Anything nobody has seen becomes a match."
  back={{
    href: resolve("/groups/[groupId]", { groupId: data.group.id }),
    label: data.group.name,
  }}
>
  {#if data.active !== null && data.replacing === null}
    <!-- One active session per group: offer it instead of a second one. -->
    <Card.Root>
      <Card.Header>
        <Card.Title>A session is already going</Card.Title>
        <Card.Description>
          {#if data.active.isHost}
            Pick up where you left off, or start over with new filters.
          {:else if data.active.isMine}
            Someone in {data.group.name} started one with you in it. A group runs
            one session at a time.
          {:else}
            Someone in {data.group.name} started one. A group runs one session at
            a time.
          {/if}
        </Card.Description>
      </Card.Header>
      <Card.Footer class="flex flex-col items-stretch gap-3">
        {#if data.active.isHost}
          <Button
            size="lg"
            href={resolve("/sessions/[watchSessionId]", {
              watchSessionId: data.active.id,
            })}
          >
            Continue the session
          </Button>
          <Button
            variant="ghost"
            href={resolve(`/groups/[groupId]/find?replace=${data.active.id}`, {
              groupId: data.group.id,
            })}
          >
            Start a new one
          </Button>
        {:else if data.active.isMine}
          <Button
            size="lg"
            href={resolve("/sessions/[watchSessionId]", {
              watchSessionId: data.active.id,
            })}
          >
            Go to the session
          </Button>
        {:else}
          <Button
            size="lg"
            href={resolve("/groups/[groupId]", { groupId: data.group.id })}
          >
            Back to {data.group.name}
          </Button>
        {/if}
      </Card.Footer>
    </Card.Root>
  {:else}
    <form method="POST" action="?/start" use:enhance={start.submit}>
      <input type="hidden" name="replace" value={data.replacing?.id ?? ""} />

      <Field.Group>
        {#if data.members.length > 0}
          <Field.Set>
            <Field.Legend variant="label">Who's watching</Field.Legend>
            <Field.Description>
              {data.replacing === null
                ? "You're in. The others join when they accept."
                : "People in this session stay in. Anyone new joins when they accept."}
            </Field.Description>
            <div class="flex flex-wrap gap-2">
              {#each data.members as member (member.userId)}
                <label class={CHIP}>
                  <input
                    class="sr-only"
                    type="checkbox"
                    name="invitedUserIds"
                    value={member.userId}
                    bind:group={invitedUserIds}
                  />
                  {member.nickname}
                </label>
              {/each}
            </div>
          </Field.Set>
        {/if}

        <FilterFields
          genres={data.genres}
          initial={data.replacing?.filters ?? NO_FILTERS}
        />
      </Field.Group>

      {#if data.replacing !== null}
        <p class="mt-6 text-sm text-muted-foreground">
          Starting ends the current session for everyone. Its matches stay on
          its page.
        </p>
      {/if}

      <Button
        type="submit"
        size="lg"
        class="mt-8 w-full"
        disabled={start.saving}
      >
        {start.saving ? "Starting…" : "Start"}
      </Button>
      {#if start.error}
        <p class="mt-3 text-sm text-destructive" role="alert">
          {start.error}
        </p>
      {/if}
    </form>
  {/if}
</Page>
