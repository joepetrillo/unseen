import { createContext } from "svelte";
import { MediaQuery } from "svelte/reactivity";
import { z } from "zod";

// Light, dark, or "system" to follow the device. The pick is kept in a cookie
// for this browser, so the server renders the toggle already showing it, and
// the script in app.html reads it before the page first draws, which is why
// there's no flash of the wrong theme. That script repeats applyTheme below in
// plain JavaScript (theme.svelte.spec.ts checks they agree).

export const themeChoiceSchema = z.enum(["light", "dark", "system"]);
export type ThemeChoice = z.infer<typeof themeChoiceSchema>;

export const THEME_COOKIE = "theme";
// 400 days, the longest a browser keeps a cookie; each pick restarts it.
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

// The status bar colors, matching --background in layout.css.
const THEME_COLORS = { light: "#ffffff", dark: "#0a0a0a" } as const;

/** Anything unknown (no cookie, an old value) means System. */
export function parseThemeChoice(stored: unknown): ThemeChoice {
  return themeChoiceSchema.catch("system").parse(stored);
}

/** One per page, shared through context (see the root +layout.svelte). */
export class Theme {
  /** What the person picked in this browser. */
  choice = $state<ThemeChoice>("system");
  // Reactive: on System, a device switch (say, at sunset) updates `dark`.
  #systemDark = new MediaQuery("prefers-color-scheme: dark");
  /** Whether the page is dark right now. */
  dark = $derived(
    this.choice === "dark" ||
      (this.choice === "system" && this.#systemDark.current)
  );
  #otherTabs: BroadcastChannel | null = null;

  /** `choice` is the cookie's, read by the server (see +layout.server.ts). */
  constructor(choice: ThemeChoice) {
    this.choice = choice;
  }

  pick(choice: ThemeChoice) {
    this.choice = choice;
    // Not HttpOnly: the browser writes it. Lax, like any cookie that only
    // changes how pages look.
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${String(COOKIE_MAX_AGE)}; samesite=lax`;
    this.#otherTabs?.postMessage(choice);
  }

  /**
   * Follows picks made in this browser's other tabs, until the returned
   * cleanup runs. Cookies have no change event, so the tabs tell each other.
   */
  followOtherTabs(): () => void {
    const channel = new BroadcastChannel(THEME_COOKIE);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      this.choice = parseThemeChoice(event.data);
    };
    this.#otherTabs = channel;
    return () => {
      channel.close();
      this.#otherTabs = null;
    };
  }
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
