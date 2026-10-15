import { afterEach, describe, expect, it, vi } from "vitest";

import appHtml from "../app.html?raw";
import {
  applyTheme,
  parseThemeChoice,
  THEME_COOKIE,
  Theme,
} from "./theme.svelte.ts";

// The script in app.html paints the first frame; Theme and applyTheme take
// over after that. If they ever disagreed, the page would flash or switch
// theme as it loads.

const script = /<script>([\s\S]*?)<\/script>/.exec(appHtml)?.[1] ?? "";

function deviceIsDark(dark: boolean) {
  // Both the script and Svelte's MediaQuery ask window.matchMedia.
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: query.includes("dark") && dark,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
}

function themeColor() {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.content;
}

const meta = document.createElement("meta");
meta.name = "theme-color";
document.head.append(meta);

function clearCookie() {
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
}

afterEach(() => {
  vi.restoreAllMocks();
  clearCookie();
  document.documentElement.classList.remove("dark");
});

describe("the app.html script and Theme", () => {
  it("has a script to run", () => {
    expect(script).toContain(`${THEME_COOKIE}=`);
  });

  for (const stored of [null, "light", "dark", "system", "sepia"]) {
    for (const dark of [false, true]) {
      it(`agree with ${String(stored)} stored on a ${dark ? "dark" : "light"} device`, () => {
        deviceIsDark(dark);
        if (stored !== null) {
          document.cookie = `${THEME_COOKIE}=${stored}; path=/`;
        }

        // The script runs as the page loads.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval -- it's our own app.html.
        const run = new Function(script) as () => void;
        run();
        const fromScript = {
          dark: document.documentElement.classList.contains("dark"),
          color: themeColor(),
        };
        expect(fromScript.dark).toBe(
          stored === "dark" || (stored !== "light" && dark)
        );

        // Then the app takes over, from the cookie as the server read it,
        // without changing anything.
        document.documentElement.classList.remove("dark");
        applyTheme(new Theme(parseThemeChoice(stored)).dark);
        expect({
          dark: document.documentElement.classList.contains("dark"),
          color: themeColor(),
        }).toEqual(fromScript);
      });
    }
  }
});

describe("Theme", () => {
  it("keeps a pick in this browser's cookie", () => {
    deviceIsDark(false);
    const theme = new Theme("system");
    theme.pick("dark");
    expect(theme.dark).toBe(true);
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  });

  it("follows a pick made in another tab", async () => {
    deviceIsDark(true);
    const here = new Theme("system");
    const there = new Theme("system");
    const stopHere = here.followOtherTabs();
    const stopThere = there.followOtherTabs();
    try {
      there.pick("light");
      await vi.waitFor(() => {
        expect(here.dark).toBe(false);
      });
      there.pick("system");
      await vi.waitFor(() => {
        expect(here.choice).toBe("system");
      });
      expect(here.dark).toBe(true);
    } finally {
      stopHere();
      stopThere();
    }
  });

  it("reads anything unknown as System", () => {
    expect(parseThemeChoice(undefined)).toBe("system");
    expect(parseThemeChoice("sepia")).toBe("system");
    expect(parseThemeChoice("dark")).toBe("dark");
  });
});
