import { afterEach, describe, expect, it, vi } from "vitest";

import appHtml from "../app.html?raw";
import { applyTheme, THEME_STORAGE_KEY, Theme } from "./theme.svelte.ts";

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

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("the app.html script and Theme", () => {
  it("has a script to run", () => {
    expect(script).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
  });

  for (const stored of [null, "light", "dark", "system", "sepia"]) {
    for (const dark of [false, true]) {
      it(`agree with ${String(stored)} stored on a ${dark ? "dark" : "light"} device`, () => {
        deviceIsDark(dark);
        if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);

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

        // Then the app takes over without changing anything.
        document.documentElement.classList.remove("dark");
        applyTheme(new Theme().dark);
        expect({
          dark: document.documentElement.classList.contains("dark"),
          color: themeColor(),
        }).toEqual(fromScript);
      });
    }
  }
});

describe("Theme", () => {
  it("keeps a pick in this browser", () => {
    deviceIsDark(false);
    const theme = new Theme();
    expect(theme.choice).toBe("system");
    theme.pick("dark");
    expect(theme.dark).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(new Theme().choice).toBe("dark");
  });

  it("follows a pick made in another tab", () => {
    deviceIsDark(true);
    const theme = new Theme();
    const changed = (key: string, newValue: string | null) => {
      theme.followOtherTabs(new StorageEvent("storage", { key, newValue }));
    };
    changed(THEME_STORAGE_KEY, "light");
    expect(theme.dark).toBe(false);
    // Another key is someone else's business.
    changed("other", "dark");
    expect(theme.choice).toBe("light");
    // Cleared storage means System again.
    changed(THEME_STORAGE_KEY, null);
    expect(theme.choice).toBe("system");
    expect(theme.dark).toBe(true);
  });
});
