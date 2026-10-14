<script lang="ts">
  import { enhance } from "$app/forms";
  import { resolve } from "$app/paths";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import ListGroup from "#lib/components/ListGroup.svelte";
  import MatchList from "#lib/components/MatchList.svelte";
  import MoviePoster from "#lib/components/MoviePoster.svelte";
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
  // One form per row, one save at a time: the movie is part of each input,
  // so every row gets its own action ID.
  const watched = new ActionForm({ scope });
  const correction = new ActionForm({ scope });
  const unwatched = new ActionForm({ scope });

  // "Sam", "Sam and Alex", "Sam, Alex, and Jo".
  const names = new Intl.ListFormat("en", { type: "conjunction" });
</script>

<svelte:head><title>{group.name} · Vunu</title></svelte:head>

<Page title={group.name} back={{ href: resolve("/"), label: "Home" }}>
  <!-- Nothing to start: the deck is always there, and everyone in the
       group counts toward every match. -->
  <Button
    size="lg"
    class="mb-10 w-full"
    href={resolve("/groups/[groupId]/find", { groupId: group.id })}
  >
    Find a movie
  </Button>

  <section
    id="matches"
    class="mb-10 scroll-mt-6"
    aria-labelledby="matches-heading"
  >
    <h2 id="matches-heading" class="text-xl font-semibold">
      Matches ({data.matches.length})
    </h2>
    {#if data.matches.length === 0}
      <p class="mt-2 text-muted-foreground">
        No matches yet. A movie everyone here says Not seen to shows up here.
      </p>
    {:else}
      <p class="mt-1 mb-3 text-muted-foreground">
        Nobody here has seen these. Pick one together.
      </p>
      {#snippet matchActions(movie: { id: number; title: string })}
        <form method="POST" action="?/watched" use:enhance={watched.submit}>
          <input type="hidden" name="movieId" value={movie.id} />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={watched.saving}
            aria-label={`We watched ${movie.title}`}
          >
            We watched this
          </Button>
        </form>
        <form method="POST" action="?/seen" use:enhance={correction.submit}>
          <input type="hidden" name="movieId" value={movie.id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={correction.saving}
            aria-label={`Actually, I've seen ${movie.title}`}
          >
            Actually, I've seen this
          </Button>
        </form>
      {/snippet}
      <MatchList matches={data.matches} actions={matchActions} />
      {#if watched.error ?? correction.error}
        <p class="mt-3 text-sm text-destructive" role="alert">
          {watched.error ?? correction.error}
        </p>
      {/if}
    {/if}
  </section>

  {#if data.waitingOn.length > 0}
    <section class="mb-10" aria-labelledby="waiting-heading">
      <h2 id="waiting-heading" class="text-xl font-semibold">Almost</h2>
      <p class="mt-1 mb-3 text-muted-foreground">
        Not matches yet: these wait on someone's answer.
      </p>
      <ListGroup>
        {#each data.waitingOn as row (row.movie.id)}
          <li>
            <Item.Root class="flex-nowrap rounded-none">
              <Item.Media class="w-12 shrink-0">
                <MoviePoster
                  posterPath={row.movie.posterPath}
                  title={row.movie.title}
                  sizes="48px"
                />
              </Item.Media>
              <Item.Content class="min-w-0">
                <Item.Title class="line-clamp-2">{row.movie.title}</Item.Title>
                <Item.Description>
                  Waiting on {names.format(row.waitingOn)}
                </Item.Description>
              </Item.Content>
            </Item.Root>
          </li>
        {/each}
      </ListGroup>
    </section>
  {/if}

  {#if data.watched.length > 0}
    <section class="mb-10" aria-labelledby="watched-heading">
      <h2 id="watched-heading" class="text-xl font-semibold">Watched</h2>
      <p class="mt-1 mb-3 text-muted-foreground">
        Movies this group marked as watched. They won't come up again.
      </p>
      <ListGroup>
        {#each data.watched as movie (movie.id)}
          <li>
            <Item.Root class="flex-nowrap rounded-none">
              <Item.Media class="w-12 shrink-0">
                <MoviePoster
                  posterPath={movie.posterPath}
                  title={movie.title}
                  sizes="48px"
                />
              </Item.Media>
              <Item.Content class="min-w-0">
                <Item.Title class="line-clamp-2">{movie.title}</Item.Title>
                {#if movie.year !== null}
                  <Item.Description>{movie.year}</Item.Description>
                {/if}
              </Item.Content>
              <Item.Actions>
                <form
                  method="POST"
                  action="?/unwatched"
                  use:enhance={unwatched.submit}
                >
                  <input type="hidden" name="movieId" value={movie.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={unwatched.saving}
                    aria-label={`We haven't watched ${movie.title}`}
                  >
                    Undo
                  </Button>
                </form>
              </Item.Actions>
            </Item.Root>
          </li>
        {/each}
      </ListGroup>
      {#if unwatched.error}
        <p class="mt-3 text-sm text-destructive" role="alert">
          {unwatched.error}
        </p>
      {/if}
    </section>
  {/if}

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
