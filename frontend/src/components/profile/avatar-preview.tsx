"use client"

import type { UserProfile } from "@/lib/types"

type AvatarPreviewProps = {
  profile: UserProfile
  isRemoving: boolean
  onRemove: () => void
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

/**
 * Render the current profile avatar, including the remove action.
 *
 * @param props - Avatar preview props.
 * @returns The avatar preview card.
 */
export function AvatarPreview({
  profile,
  isRemoving,
  onRemove,
}: AvatarPreviewProps) {
  const avatarUrl = profile.avatar_thumbnail_url ?? profile.avatar_url
  const initials = buildInitials(
    profile.display_name || profile.email || profile.username,
  )

  return (
    <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
      <div className="space-y-1">
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Avatar</p>
        <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
          Profile image
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${profile.display_name || profile.username} avatar`}
            className="h-24 w-24 rounded-3xl border border-border/10 object-cover shadow-sm"
            src={avatarUrl}
          />
        ) : (
          <div className="inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-2xl font-semibold text-primary-foreground shadow-sm">
            {initials}
          </div>
        )}
        <div className="space-y-2 text-sm leading-6 text-muted">
          <p className="m-0">
            Drop in a square image to personalize the editor cockpit and header menu.
          </p>
          {profile.avatar_url ? (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/16 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRemoving}
              onClick={onRemove}
              type="button"
            >
              {isRemoving ? "Removing avatar..." : "Remove avatar"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
