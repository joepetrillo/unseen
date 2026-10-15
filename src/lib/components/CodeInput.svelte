<script lang="ts">
  import type { ComponentProps } from "svelte";

  import * as InputOTP from "#lib/components/ui/input-otp/index.ts";

  type Props = Omit<
    ComponentProps<typeof InputOTP.Root>,
    "children" | "onComplete"
  > & {
    /** Shows the boxes in the error color. */
    invalid?: boolean;
  };

  let { value = $bindable(""), invalid = false, ...rest }: Props = $props();

  let input = $state<HTMLInputElement | null>(null);
</script>

<!-- One box per character, drawn over a single real input that stays
     invisible: typing, pasting, and a phone's code autofill all work as on a
     normal field, and the form submits it under its `name`. Filling the last
     box submits the form, so a code from the keyboard's suggestion bar signs
     in with one tap. iOS Safari can still draw that input's caret, at its
     left edge, despite caret-color: transparent; the clip hides that strip,
     which is only the first box's rounded corner. -->
<InputOTP.Root
  bind:value
  bind:inputRef={input}
  class="w-full [&_[data-pin-input-input]]:[clip-path:inset(0_0_0_0.75rem)]"
  onComplete={() => input?.form?.requestSubmit()}
  aria-invalid={invalid || undefined}
  {...rest}
>
  {#snippet children({ cells })}
    <InputOTP.Group class="w-full">
      <!-- Keyed by position: that's what a cell is, and the objects are
           rebuilt on every change. -->
      {#each cells as cell, position (position)}
        <InputOTP.Slot
          {cell}
          class="h-14 w-auto flex-1 font-mono text-2xl"
          aria-invalid={invalid || undefined}
        />
      {/each}
    </InputOTP.Group>
  {/snippet}
</InputOTP.Root>
