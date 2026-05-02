"use client"

import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) return null

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex items-center rounded-full border border-border/12 bg-card/85 px-3 py-2 text-sm text-foreground shadow-panel transition hover:bg-muted"
    >
      {isDark ? "Moon Dark" : "Sun Light"}
    </button>
  )
}
