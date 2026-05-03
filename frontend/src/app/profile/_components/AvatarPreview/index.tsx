"use client"

import { UserAvatar } from "@/components/elements/UserAvatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { UserProfile } from "@/lib/types"

type AvatarPreviewProps = {
  /** Current user profile used to render the avatar or initials. */
  profile: UserProfile
  /** Whether an avatar removal request is currently in flight. */
  isRemoving: boolean
  /** Callback that removes the current avatar. */
  onRemove: () => void
}

/** Render the current profile avatar, including the remove action. */
export function AvatarPreview({
  profile,
  isRemoving,
  onRemove,
}: AvatarPreviewProps) {
  const avatarUrl = profile.avatar_thumbnail_url ?? profile.avatar_url

  return (
    <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Avatar</p>
          <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
            Profile image
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <UserAvatar
            avatarUrl={avatarUrl}
            className="size-24 border border-border/10 shadow-sm after:hidden"
            fallbackClassName="bg-primary text-2xl font-semibold text-primary-foreground"
            name={profile.display_name || profile.email || profile.username}
            size="lg"
          />
          <div className="space-y-2 text-sm leading-6 text-muted">
            <p className="m-0">
              Drop in a square image to personalize the editor cockpit and header menu.
            </p>
            {profile.avatar_url ? (
              <Button
                className="min-h-11 rounded-full px-4 py-3"
                disabled={isRemoving}
                onClick={onRemove}
                size="lg"
                type="button"
                variant="destructive"
              >
                {isRemoving ? "Removing avatar..." : "Remove avatar"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
