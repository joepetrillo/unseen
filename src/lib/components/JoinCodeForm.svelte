<script lang="ts">
  import { enhance } from "$app/forms";

  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { Input } from "#lib/components/ui/input/index.ts";
  import {
    INVITE_CODE_ALPHABET,
    INVITE_CODE_LENGTH,
  } from "#lib/group-fields.ts";

  interface Props {
    /** The page's `findInvite` answer, or a dead link's message. */
    error?: string | undefined;
  }

  let { error }: Props = $props();
  // Unique per component instance and the same on server and browser, so the
  // label and error can point at the input (like React's useId).
  const id = $props.id();

  let code = $state("");
  let finding = $state(false);
  const notInCode = new RegExp(`[^${INVITE_CODE_ALPHABET}]`, "g");

  // Rewrites what was typed or pasted into something that could be a code:
  // uppercase, only the code's characters ("k7q-m2x" becomes "K7QM2X"), and
  // no more than six. Not `maxlength`: it would cut a pasted "K7Q-M2X" at
  // the dash before the dash is removed.
  function keepCodeCharacters(
    event: Event & { currentTarget: HTMLInputElement }
  ) {
    code = event.currentTarget.value
      .toUpperCase()
      .replace(notInCode, "")
      .slice(0, INVITE_CODE_LENGTH);
    // Svelte only updates the DOM when `code` changes; a rejected character
    // leaves `code` as it was, so put the cleaned value back by hand.
    event.currentTarget.value = code;
  }
</script>

<!-- Posts to the current page's `find` action (see findInvite). -->
<form
  method="POST"
  action="?/find"
  use:enhance={() => {
    finding = true;
    return async ({ update }) => {
      try {
        // Keep the wrong code visible next to its error.
        await update({ reset: false });
      } finally {
        finding = false;
      }
    };
  }}
>
  <Field.Group>
    <Field.Field data-invalid={error !== undefined}>
      <Field.Label for="{id}-code">Invite code</Field.Label>
      <Input
        id="{id}-code"
        class="h-14 text-center font-mono text-2xl tracking-[0.3em] uppercase"
        name="code"
        value={code}
        oninput={keepCodeCharacters}
        required
        minlength={INVITE_CODE_LENGTH}
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        enterkeyhint="go"
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
      />
      {#if error}
        <Field.Error id="{id}-error">{error}</Field.Error>
      {/if}
    </Field.Field>
    <Button type="submit" size="lg" disabled={finding}>
      {finding ? "Checking…" : "Continue"}
    </Button>
  </Field.Group>
</form>
