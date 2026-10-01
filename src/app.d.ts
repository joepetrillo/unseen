import type { AuthSession } from "#lib/server/auth.ts";

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // Set by hooks.server.ts on every request. Null when signed out.
    interface Locals {
      user: AuthSession["user"] | null;
      session: AuthSession["session"] | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
