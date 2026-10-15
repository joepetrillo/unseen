<script lang="ts">
  import { Toggle as TogglePrimitive } from "bits-ui";

  import { cn } from "#lib/utils.ts";

  import {
    type ToggleSize,
    type ToggleVariant,
    toggleVariants,
  } from "./variants.ts";

  let {
    ref = $bindable(null),
    pressed = $bindable(false),
    class: className,
    size = "default",
    variant = "default",
    ...restProps
  }: TogglePrimitive.RootProps & {
    variant?: ToggleVariant;
    size?: ToggleSize;
  } = $props();
</script>

<TogglePrimitive.Root
  bind:ref
  bind:pressed
  data-slot="toggle"
  class={cn(toggleVariants({ variant, size }), className)}
  {...restProps}
/>
