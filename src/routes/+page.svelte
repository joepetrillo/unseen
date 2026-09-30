<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<main class="mx-auto max-w-xl p-4">
  <h1 class="text-2xl font-bold">Unseen</h1>
  <p class="mt-2">Find movies nobody in your group has seen.</p>
  <p class="mt-4 text-sm">
    <a class="underline" href={resolve("dev/movies")}
      >Browse the catalog (dev)</a
    >
  </p>
</main>
