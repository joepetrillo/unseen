<script lang="ts">
  import { enhance } from "$app/forms";
  import Share08Icon from "@hugeicons/core-free-icons/Share08Icon";
  import { HugeiconsIcon } from "@hugeicons/svelte";

  import { ActionForm } from "#lib/action-form.svelte.ts";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Card from "#lib/components/ui/card/index.ts";

  interface Props {
    groupId: string;
    groupName: string;
    code: string;
    url: string;
    isOwner: boolean;
  }

  let { groupId, groupName, code, url, isOwner }: Props = $props();

  // What the share button last did, shown next to it.
  let status = $state<string | null>(null);

  const reset = new ActionForm({
    scope: () => groupId,
    confirm: () =>
      "Make a new invite? The current link and code will stop working.",
  });

  // True while the share sheet is open. Plain `let`: nothing on screen
  // shows it. iOS Safari allows one share sheet at a time and throws if
  // `share()` is called again before the last one has fully closed (a quick
  // second tap); its promise can also stay pending afterwards.
  let shareSheetOpen = false;

  // Phones open their share sheet (Messages, WhatsApp, …). Browsers without
  // one, a tap while one is still open, and any share failure copy the link
  // instead, so the button always does something useful.
  async function share() {
    status = null;
    const text = `Join ${groupName} on Vunu (code ${code})`;
    // TypeScript's DOM types say every browser has `share`; desktop Firefox
    // doesn't, so check on a plain object.
    if ("share" in (navigator as object) && !shareSheetOpen) {
      shareSheetOpen = true;
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch (error) {
        // Closing the share sheet without picking anything isn't a failure.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        shareSheetOpen = false;
      }
    }
    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      status = "Link copied.";
    } catch {
      status = "Couldn't copy. Copy the link above instead.";
    }
  }
</script>

<Card.Root role="region" aria-labelledby="invite-heading">
  <Card.Header>
    <Card.Title id="invite-heading">Invite people</Card.Title>
    <Card.Description>Anyone with this link or code can join.</Card.Description>
  </Card.Header>
  <Card.Content>
    <p
      class="font-mono text-4xl font-semibold tracking-[0.25em]"
      aria-label="Invite code"
    >
      {code}
    </p>
    <p class="mt-2 text-sm break-all text-muted-foreground">{url}</p>
  </Card.Content>
  <Card.Footer class="flex flex-col items-stretch gap-3">
    <Button size="lg" onclick={share}>
      <HugeiconsIcon icon={Share08Icon} data-icon="inline-start" />
      Share invite
    </Button>
    {#if isOwner}
      <form
        class="flex flex-col"
        method="POST"
        action="?/resetInvite"
        use:enhance={reset.submit}
      >
        <Button type="submit" variant="ghost" disabled={reset.saving}>
          {reset.saving ? "Resetting…" : "Reset invite"}
        </Button>
      </form>
    {/if}
    <!-- Polite: announced after whatever the screen reader is saying. -->
    <p class="text-center text-sm empty:hidden" aria-live="polite">
      {status}
    </p>
    {#if reset.error}
      <p class="text-sm text-destructive" role="alert">{reset.error}</p>
    {/if}
  </Card.Footer>
</Card.Root>
