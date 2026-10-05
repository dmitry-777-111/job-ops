import * as React from "react";

export type ColorTheme = "light" | "dark";

const STORAGE_KEY = "pathfinder.colorTheme";

function resolveInitialTheme(): ColorTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Ignore restricted storage environments.
  }

  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
}

function applyTheme(theme: ColorTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function useColorTheme() {
  const [theme, setThemeState] = React.useState<ColorTheme>(() =>
    resolveInitialTheme(),
  );

  React.useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore restricted storage environments.
    }
  }, [theme]);

  const setTheme = React.useCallback((next: ColorTheme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggleTheme } as const;
}

export function initializeColorTheme() {
  applyTheme(resolveInitialTheme());
}
