"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"

/** Toggle the active theme between light and dark modes. */
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
    <Button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="min-h-11 rounded-full border-trim-offset bg-page-base px-3 py-2 text-sm text-content-active shadow-panel hover:bg-page-offset"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="lg"
      type="button"
      variant="outline"
    >
      {isDark ? <Moon /> : <Sun />}
      {isDark ? "Dark mode" : "Light mode"}
    </Button>
  )
}
