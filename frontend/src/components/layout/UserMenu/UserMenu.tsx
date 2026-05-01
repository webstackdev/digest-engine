"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useEffect, useMemo, useRef, useState } from "react"

import { fetchProfile, PROFILE_QUERY_KEY } from "@/lib/profile"

const AVATAR_TONES = [
  "bg-primary text-primary-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-sidebar text-sidebar-foreground",
  "bg-destructive text-destructive-foreground",
]

function buildInitials(name: string) {
  const words = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (words.length === 0) {
    return "GU"
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}

function buildAvatarTone(name: string) {
  const total = Array.from(name).reduce((sum, character) => {
    return sum + character.charCodeAt(0)
  }, 0)

  return AVATAR_TONES[total % AVATAR_TONES.length] ?? AVATAR_TONES[0]
}

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
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    retry: false,
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  const accountName =
    profileQuery.data?.display_name ||
    profileQuery.data?.email ||
    profileQuery.data?.username ||
    "Guest user"
  const accountEmail = profileQuery.data?.email || ""
  const isAuthenticated = Boolean(profileQuery.data)
  const avatarUrl =
    profileQuery.data?.avatar_thumbnail_url ?? profileQuery.data?.avatar_url ?? null
  const menuPanelId = "user-menu-panel"

  const initials = useMemo(() => buildInitials(accountName), [accountName])
  const avatarTone = useMemo(() => buildAvatarTone(accountName), [accountName])
  const triggerContent = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={`${accountName} avatar`}
      className="h-full w-full rounded-full object-cover"
      src={avatarUrl}
    />
  ) : (
    initials
  )

  return (
    <div className="relative" ref={containerRef}>
      {isOpen ? (
        <button
          aria-controls={menuPanelId}
          aria-expanded="true"
          aria-haspopup="dialog"
          aria-label="Open user menu"
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/10 text-sm font-semibold shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary/20 ${avatarTone}`}
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          type="button"
        >
          {triggerContent}
        </button>
      ) : (
        <button
          aria-controls={menuPanelId}
          aria-expanded="false"
          aria-haspopup="dialog"
          aria-label="Open user menu"
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/10 text-sm font-semibold shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary/20 ${avatarTone}`}
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          type="button"
        >
          {triggerContent}
        </button>
      )}

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-20 mt-3 w-72 rounded-3xl border border-border/10 bg-card/95 p-4 shadow-panel backdrop-blur-xl"
          id={menuPanelId}
          role="dialog"
          aria-label="User menu"
          aria-modal="false"
        >
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${accountName} avatar`}
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                src={avatarUrl}
              />
            ) : (
              <div
                aria-hidden="true"
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone}`}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-semibold text-foreground">{accountName}</p>
              <p className="m-0 truncate text-sm text-muted">
                {accountEmail || "Signed in account"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-muted/45 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/65"
              href="/profile"
              onClick={() => setIsOpen(false)}
            >
              View profile
            </Link>
            <div className="rounded-2xl border border-border/10 bg-muted/45 px-4 py-3 text-sm leading-6 text-muted">
              Update your avatar, display name, and timezone from the profile workspace.
            </div>
          </div>

          {isAuthenticated ? (
            <button
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              type="button"
            >
              Log out
            </button>
          ) : (
            <p className="mt-4 mb-0 text-sm leading-6 text-muted">
              No active NextAuth session was found for this browser.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
