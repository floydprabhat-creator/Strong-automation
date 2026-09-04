"use client";

import { IconMoon, IconSun } from "@/components/ui/icons";

/**
 * Light/dark switch.
 *
 * The theme is a CSS `color-scheme` decision — every design token resolves
 * through `light-dark()` in `globals.css` — so switching is one attribute on
 * <html>, and no React state is involved at all: the icon is chosen by CSS and
 * the current theme is read from the DOM at click time. That also means the
 * button renders correctly on the server and on first paint.
 *
 * With nothing stored, the OS preference wins.
 */

export const THEME_STORAGE_KEY = "strong-automation:theme";

/**
 * Runs before hydration, inlined in <head>. Anything later produces a flash of
 * the wrong theme on load. Reading localStorage can throw in a locked-down
 * browser, so failure falls through to the OS preference.
 */
export const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) {}
`.trim();

type Theme = "light" | "dark";

/** The theme in effect right now: an explicit override, else the OS preference. */
function activeTheme(): Theme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  function toggle() {
    const next: Theme = activeTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode or blocked storage: the choice holds for this page only.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Toggle light or dark theme"
      className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {/* Both render; the CSS in globals.css reveals the one matching the active
          scheme, covering system / forced-light / forced-dark alike. */}
      <IconSun size={16} className="theme-icon-dark" />
      <IconMoon size={16} className="theme-icon-light" />
    </button>
  );
}
