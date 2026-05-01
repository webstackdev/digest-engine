"use client"

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes"
import type { ReactNode } from "react"

type AppThemeProviderProps = Omit<ThemeProviderProps, "children"> & {
  children: ReactNode
}

/**
 * Provide client-side theme state for the App Router layout.
 *
 * This thin wrapper keeps the server layout from importing the client-only
 * provider directly while preserving the upstream `next-themes` prop contract.
 *
 * @param props - Theme provider props forwarded to `next-themes`.
 * @returns The wrapped theme provider.
 */
export function ThemeProvider(props: AppThemeProviderProps) {
  return <NextThemesProvider {...props} />
}
