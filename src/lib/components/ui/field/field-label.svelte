<script lang="ts">
  import type { Label as LabelPrimitive } from "bits-ui";

  import { Label } from "#lib/components/ui/label/index.ts";
  import { cn } from "#lib/utils.ts";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
    // Bits UI's type rather than ComponentProps<typeof Label>: ESLint can't read
    // types out of a .svelte file, so it would see `any`.
  }: LabelPrimitive.RootProps = $props();
</script>

<Label
  bind:ref
  data-slot="field-label"
  class={cn(
    "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-xl has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-input/40 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-[3px] has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-4 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
    "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
    className
  )}
  {...restProps}
>
  {@render children?.()}
</Label>
