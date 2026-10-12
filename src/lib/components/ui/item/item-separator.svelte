<script lang="ts">
  import type { Separator as SeparatorPrimitive } from "bits-ui";

  import { Separator } from "#lib/components/ui/separator/index.ts";
  import { cn } from "#lib/utils.ts";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
    // Bits UI's type: ESLint can't read types out of a .svelte file.
  }: SeparatorPrimitive.RootProps = $props();
</script>

<Separator
  bind:ref
  data-slot="item-separator"
  orientation="horizontal"
  class={cn("my-2", className)}
  {...restProps}
/>
