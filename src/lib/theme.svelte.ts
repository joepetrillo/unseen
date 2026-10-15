import { browser } from "$app/env";
import { createContext } from "svelte";
import { MediaQuery } from "svelte/reactivity";
import { z } from "zod";

// Light, dark, or "system" to follow the device. The pick is kept in this
// browser's localStorage, so it never reaches the server: the script in
// app.html reads it before the page first draws, which is why there's no flash
// of the wrong theme. That script repeats applyTheme below in plain JavaScript
// (theme.svelte.spec.ts checks they agree).

export const themeChoiceSchema = z.enum(["light", "dark", "system"]);
export type ThemeChoice = z.infer<typeof themeChoiceSchema>;

export const THEME_STORAGE_KEY = "theme";

// The status bar colors, matching --background in layout.css.
const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

/** Anything unknown (nothing stored, an old value) means System. */
function parseChoice(stored: string | null): ThemeChoice {
  return themeChoiceSchema.catch("system").parse(stored);
}

function readStoredChoice(): ThemeChoice {
  // The server can't know: it renders System, and hydration fixes the toggle.
  if (!browser) return "system";
  try {
    return parseChoice(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage blocked (some private modes): follow the device.
    return "system";
  }
}

/** One per page, shared through context (see the root +layout.svelte). */
export class Theme {
  /** What the person picked in this browser. */
  choice = $state<ThemeChoice>(readStoredChoice());
  // Reactive: on System, a device switch (say, at sunset) updates `dark`.
  #systemDark = new MediaQuery("prefers-color-scheme: dark");
  /** Whether the page is dark right now. */
  dark = $derived(
    this.choice === "dark" ||
      (this.choice === "system" && this.#systemDark.current)
  );

  pick(choice: ThemeChoice) {
    this.choice = choice;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      // Storage blocked: the pick lasts until the page reloads.
    }
  }

  /** For `<svelte:window onstorage>`: another tab picked, so follow it. */
  followOtherTabs = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      this.choice = parseChoice(event.newValue);
    }
  };
}

export const [getTheme, setTheme] = createContext<Theme>();

/** Puts the theme on the page: the `dark` class and the status bar color. */
export function applyTheme(dark: boolean) {
  const root = document.documentElement;
  if (root.classList.contains("dark") !== dark) {
    // Without this, anything with a color transition (buttons, rows) would
    // fade on its own schedule instead of switching with the rest.
    const pause = document.createElement("style");
    pause.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.append(pause);
    root.classList.toggle("dark", dark);
    // Two frames: the switch is drawn before transitions come back.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pause.remove();
      });
    });
  }
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (meta) meta.content = THEME_COLORS[dark ? "dark" : "light"];
}
