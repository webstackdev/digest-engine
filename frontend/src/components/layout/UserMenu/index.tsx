"use client"

import { useQuery } from "@tanstack/react-query"

import { DropdownMenu } from "@/components/ui/dropdown-menu"
import { fetchProfile, PROFILE_QUERY_KEY } from "@/lib/profile"

import { UserMenuContent } from "./_components/UserMenuContent"
import { UserMenuTrigger } from "./_components/UserMenuTrigger"

/**
 * Render the top-right user menu used by the shared app shell.
 *
 * The control resolves the current NextAuth session client-side so the server
 * pages do not need to thread user props through every AppShell callsite.
 * It is intentionally isolated so the menu can later grow into a richer
 * profile surface without changing the shell structure again.
 *
 * @returns A circular initials trigger with a dropdown containing account details and logout.
 */
export function UserMenu() {
  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    retry: false,
  })

  const accountName =
    profileQuery.data?.display_name ||
    profileQuery.data?.email ||
    profileQuery.data?.username ||
    "Guest user"
  const accountEmail = profileQuery.data?.email || ""
  const isAuthenticated = Boolean(profileQuery.data)
  const avatarUrl =
    profileQuery.data?.avatar_thumbnail_url ?? profileQuery.data?.avatar_url ?? null

  return (
    <DropdownMenu>
      <UserMenuTrigger accountName={accountName} avatarUrl={avatarUrl} />
      <UserMenuContent
        accountEmail={accountEmail}
        accountName={accountName}
        avatarUrl={avatarUrl}
        isAuthenticated={isAuthenticated}
      />
    </DropdownMenu>
  )
}
