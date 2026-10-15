<script lang="ts">
  import { enhance } from "$app/forms";

  import CodeInput from "#lib/components/CodeInput.svelte";
  import { Button } from "#lib/components/ui/button/index.ts";
  import * as Field from "#lib/components/ui/field/index.ts";
  import { INVITE_CODE_LENGTH } from "#lib/group-fields.ts";

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
  // Any letter or digit lands in a box, in either case (the binding below
  // uppercases it). Codes leave out 0, O, 1, I, and L, but refusing those
  // keys silently feels broken, so they're let in and the server answers
  // with its usual "not an active invite code".
  const codeCharacters = "^[A-Za-z0-9]+$";

  // A pasted "k7q-m2x" becomes "K7QM2X" before it's cut to six characters.
  function cleanPaste(text: string) {
    return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
      <CodeInput
        inputId="{id}-code"
        name="code"
        maxlength={INVITE_CODE_LENGTH}
        pattern={codeCharacters}
        pasteTransformer={cleanPaste}
        inputmode="text"
        autocomplete="off"
        autocapitalize="characters"
        enterkeyhint="go"
        required
        invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        bind:value={() => code, (typed: string) => (code = typed.toUpperCase())}
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
