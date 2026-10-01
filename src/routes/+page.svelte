<script lang="ts">
  import { refreshAll } from "$app/navigation";
  import { resolve } from "$app/paths";

  import { authClient } from "#lib/auth-client.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  async function signOut() {
    await authClient.signOut();
    // The session cookie is gone. Re-running the loads sends a request through
    // hooks.server.ts, which redirects to sign-in.
    await refreshAll();
  }
</script>

<main class="mx-auto max-w-xl p-4">
  <h1 class="text-2xl font-bold">Unseen</h1>
  <p class="mt-2">Find movies nobody in your group has seen.</p>
  {#if data.user}
    <p class="mt-4 text-sm">
      Signed in as <strong>{data.user.email}</strong>.
      <button class="underline" onclick={signOut}>Sign out</button>
    </p>
  {/if}
  <p class="mt-4 text-sm">
    <a class="underline" href={resolve("seen")}>Your seen movies</a>
  </p>
</main>
