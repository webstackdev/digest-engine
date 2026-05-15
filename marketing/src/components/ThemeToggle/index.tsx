"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "marketing-theme";

type Theme = "light" | "dark";

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function readTheme(): Theme {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (isTheme(storedTheme)) {
    return storedTheme;
  }

  const documentTheme = document.documentElement.dataset.theme;

  if (isTheme(documentTheme)) {
    return documentTheme;
  }

  return "light";
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return readTheme();
}

/**
 * Toggles the marketing site between the light and dark document themes.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleClick = () => {
    const nextTheme = theme === "light" ? "dark" : "light";

    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
  const Icon = theme === "light" ? Moon : Sun;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      suppressHydrationWarning
      className="inline-flex size-11 items-center justify-center bg-page-offset text-secondary transition-colors hover:text-secondary-offset"
    >
      <Icon aria-hidden="true" className="size-6" strokeWidth={1.9} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
