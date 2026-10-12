<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLUListElement> & { children: Snippet };

  let { children, class: className, ...restProps }: Props = $props();
</script>

<!-- An iOS-style inset grouped list: one rounded block, rows split by
     hairlines. Rows are <li> elements, usually holding an Item. -->
<ul
  class={[
    "divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10",
    className,
  ]}
  {...restProps}
>
  {@render children()}
</ul>
