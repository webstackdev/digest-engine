"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useState } from "react"

type QueryProviderProps = {
  children: ReactNode
}

/**
 * Provide the shared React Query client used by the frontend app shell.
 *
 * The client is created once per provider instance so descendants share cache state
 * and the project's default query behavior. Window-focus refetching is disabled to
 * avoid unexpected reloads while editors work through dashboard and admin flows, and
 * failed queries retry once before surfacing an error.
 *
 * @param props - Provider props.
 * @param props.children - React subtree that needs access to the shared QueryClient.
 * @returns A React Query provider wrapping the given children.
 * @example
 * ```tsx
 * <QueryProvider>
 *   <AppShell />
 * </QueryProvider>
 * ```
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
