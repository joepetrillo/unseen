<script lang="ts">
  import { ToggleGroup as ToggleGroupPrimitive } from "bits-ui";

  import type { ToggleVariants } from "#lib/components/ui/toggle/index.ts";
  import { cn } from "#lib/utils.ts";

  import { setToggleGroupCtx } from "./context.ts";

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    size = "default",
    spacing = 0,
    orientation = "horizontal",
    variant = "default",
    ...restProps
  }: ToggleGroupPrimitive.RootProps &
    ToggleVariants & {
      spacing?: number;
      orientation?: "horizontal" | "vertical";
    } = $props();

  setToggleGroupCtx({
    get variant() {
      return variant;
    },
    get size() {
      return size;
    },
    get spacing() {
      return spacing;
    },
    get orientation() {
      return orientation;
    },
  });
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<ToggleGroupPrimitive.Root
  bind:value={value as never}
  bind:ref
  {orientation}
  data-slot="toggle-group"
  data-variant={variant}
  data-size={size}
  data-spacing={spacing}
  style={`--gap: ${String(spacing)}`}
  class={cn(
    "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-[spacing=0]:data-[variant=outline]:rounded-4xl data-vertical:flex-col data-vertical:items-stretch",
    className
  )}
  {...restProps}
/>
