<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import Page from "#lib/components/Page.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Card from "#lib/components/ui/card/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { Input } from "#lib/components/ui/input/index.ts";
  import { NativeSelect } from "#lib/components/ui/native-select/index.ts";
  import {
    formatRuntime,
    NO_FILTERS,
    RUNTIME_CHOICES,
    YEAR_MAX,
    YEAR_MIN,
  } from "#lib/watch-fields.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Change filters starts from the current session's filters. Writable
  // deriveds: the fields can be edited, and reset if the page data changes
  // (another group, or another session to replace).
  let initial = $derived(data.replacing?.filters ?? NO_FILTERS);
  let runtime = $derived(
    initial.maxRuntime === null ? "" : String(initial.maxRuntime)
  );
  let minYear = $derived(initial.minYear);
  let maxYear = $derived(initial.maxYear);
  let genreIds = $derived([...initial.genreIds]);
  let invitedUserIds = $derived([...data.invited]);
  // Checkboxes styled as chips (genres and people).
  const chip =
    "cursor-pointer rounded-4xl border px-4 py-2 text-sm font-medium transition-colors select-none has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50";
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

      <!-- All optional: an untouched form starts with no filters. The
           inputs and selected genres show what's on. -->
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
                <label class={chip}>
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

        <Field.Field>
          <Field.Label for="runtime">Length</Field.Label>
          <NativeSelect
            id="runtime"
            class="w-full"
            name="maxRuntime"
            bind:value={runtime}
          >
            <option value="">Any length</option>
            {#each RUNTIME_CHOICES as minutes (minutes)}
              <option value={String(minutes)}>
                Up to {formatRuntime(minutes)}
              </option>
            {/each}
          </NativeSelect>
        </Field.Field>

        <Field.Set>
          <Field.Legend variant="label">Release year</Field.Legend>
          <div class="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputmode="numeric"
              name="minYear"
              min={YEAR_MIN}
              max={YEAR_MAX}
              placeholder="From"
              aria-label="From year"
              bind:value={minYear}
            />
            <Input
              type="number"
              inputmode="numeric"
              name="maxYear"
              min={YEAR_MIN}
              max={YEAR_MAX}
              placeholder="To"
              aria-label="To year"
              bind:value={maxYear}
            />
          </div>
        </Field.Set>

        <Field.Set>
          <Field.Legend variant="label">Genres</Field.Legend>
          <Field.Description>Pick any; none means all.</Field.Description>
          <!-- Each ticked box sends genreIds. -->
          <div class="flex flex-wrap gap-2">
            {#each data.genres as genre (genre.id)}
              <label class={chip}>
                <input
                  class="sr-only"
                  type="checkbox"
                  name="genreIds"
                  value={genre.id}
                  bind:group={genreIds}
                />
                {genre.name}
              </label>
            {/each}
          </div>
        </Field.Set>
      </Field.Group>

      {#if data.replacing !== null}
        <p class="mt-6 text-sm text-muted-foreground">
          Starting ends the current session. Its matches are saved and come up
          last next time.
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
