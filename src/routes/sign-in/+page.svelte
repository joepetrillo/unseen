<script lang="ts">
  import { authClient } from "#lib/auth-client.ts";

  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Two steps on one page: ask for the email, then for the code we sent to it.
  let step = $state<"email" | "code">("email");
  let email = $state("");
  let code = $state("");
  let pending = $state(false);
  let errorMessage = $state<string | null>(null);

  // Better Auth answers too many requests with 429; its message is generic.
  function describeError(error: { status: number; message?: string }): string {
    if (error.status === 429)
      return "Too many attempts. Wait a few minutes and try again.";
    return error.message ?? "Something went wrong. Try again.";
  }

  async function sendCode(event: SubmitEvent) {
    // The browser would otherwise submit the form as a full page request.
    event.preventDefault();
    pending = true;
    errorMessage = null;
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    pending = false;
    if (error) {
      errorMessage = describeError(error);
      return;
    }
    step = "code";
  }

  async function verifyCode(event: SubmitEvent) {
    event.preventDefault();
    pending = true;
    errorMessage = null;
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    if (error) {
      pending = false;
      errorMessage = describeError(error);
      return;
    }
    // The response set the session cookie. A full page load (not `goto`) lets
    // the server render the target fresh as the signed-in user; `redirectTo`
    // is already limited to same-site paths by +page.ts.
    window.location.assign(data.redirectTo);
  }

  function useDifferentEmail() {
    step = "email";
    code = "";
    errorMessage = null;
  }
</script>

<svelte:head><title>Sign in · Unseen</title></svelte:head>

<main class="mx-auto max-w-sm p-4">
  <h1 class="text-2xl font-bold">Sign in to Unseen</h1>

  {#if step === "email"}
    <form class="mt-6 flex flex-col gap-3" onsubmit={sendCode}>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium">Email</span>
        <input
          class="rounded border px-3 py-2"
          type="email"
          name="email"
          autocomplete="email"
          required
          bind:value={email}
        />
      </label>
      <button
        class="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Sending…" : "Email me a code"}
      </button>
    </form>
  {:else}
    <p class="mt-6 text-sm">
      We sent a 6-digit code to <strong>{email}</strong>. It expires in 5
      minutes.
    </p>
    <form class="mt-4 flex flex-col gap-3" onsubmit={verifyCode}>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium">Code</span>
        <!-- one-time-code lets phones offer the code from the email. The
             pattern is a JS string because Svelte reads {6} in a quoted
             attribute as an expression, turning it into "[0-9]6". -->
        <input
          class="rounded border px-3 py-2 tracking-widest"
          type="text"
          name="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern={"[0-9]{6}"}
          maxlength="6"
          required
          bind:value={code}
        />
      </label>
      <button
        class="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        class="text-sm underline"
        onclick={useDifferentEmail}
      >
        Use a different email
      </button>
    </form>
  {/if}

  {#if errorMessage}
    <p class="mt-4 text-sm text-red-700" role="alert">{errorMessage}</p>
  {/if}
</main>
