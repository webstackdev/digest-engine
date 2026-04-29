"use client"

import { getSession, signOut } from "next-auth/react"
import type { Session } from "next-auth"
import { useEffect, useMemo, useRef, useState } from "react"

type AccountIdentity = {
  name: string
  email: string
}

const AVATAR_TONES = [
  "bg-primary text-white",
  "bg-warning text-ink",
  "bg-sidebar text-sidebar-ink",
  "bg-danger text-white",
]

function buildAccountIdentity(session: Session | null): AccountIdentity {
  const fallbackName = "Guest user"
  const sessionName = session?.user?.name?.trim() || ""
  const sessionEmail = session?.user?.email?.trim() || ""

  return {
    name: sessionName || sessionEmail || fallbackName,
    email: sessionEmail,
  }
}

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
  const [account, setAccount] = useState<AccountIdentity>({
    name: "Guest user",
    email: "",
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadSession() {
      const session = await getSession()
      if (!isActive) {
        return
      }

      setAccount(buildAccountIdentity(session))
      setIsAuthenticated(Boolean(session?.user))
    }

    void loadSession()

    return () => {
      isActive = false
    }
  }, [])

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

  const initials = useMemo(() => buildInitials(account.name), [account.name])
  const avatarTone = useMemo(() => buildAvatarTone(account.name), [account.name])

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open user menu"
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-ink/10 text-sm font-semibold shadow-sm transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary/20 ${avatarTone}`}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        {initials}
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-20 mt-3 w-72 rounded-3xl border border-ink/10 bg-surface/95 p-4 shadow-panel backdrop-blur-xl"
          role="menu"
        >
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone}`}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="m-0 truncate text-sm font-semibold text-ink">{account.name}</p>
              <p className="m-0 truncate text-sm text-muted">
                {account.email || "Signed in account"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-ink/10 bg-surface-strong/45 px-4 py-3 text-sm leading-6 text-muted">
            Profile actions will expand here next. Logout is wired now so the header affordance is already in place.
          </div>

          {isAuthenticated ? (
            <button
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              role="menuitem"
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