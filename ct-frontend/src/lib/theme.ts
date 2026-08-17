export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "cashlog-theme";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyThemeClass(theme: Theme): Theme {
  document.documentElement.classList.toggle("dark", theme === "dark");
  return theme;
}

export function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (stored === "system") return getSystemTheme();
  return "light";
}

export function persistTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.cookie = `${THEME_STORAGE_KEY}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Server-side: only explicit dark/light avoids hydration mismatch */
export function getServerDarkClass(cookieValue: string | undefined): boolean {
  return cookieValue === "dark";
}
