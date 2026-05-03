import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const AVATAR_TONES = [
  "bg-primary text-primary-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-sidebar text-sidebar-foreground",
  "bg-destructive text-destructive-foreground",
]

type UserAvatarProps = {
  /** Preferred display name used for initials and image alt text. */
  name: string
  /** Optional profile image URL. */
  avatarUrl?: string | null
  /** Base avatar size preset. */
  size?: "default" | "sm" | "lg"
  /** Additional classes for the avatar root. */
  className?: string
  /** Additional classes for the fallback badge. */
  fallbackClassName?: string
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

/** Render a user avatar with an image when present and initials otherwise. */
export function UserAvatar({
  name,
  avatarUrl = null,
  size = "default",
  className,
  fallbackClassName,
}: UserAvatarProps) {
  return (
    <Avatar className={className} size={size}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${name} avatar`}
          className="aspect-square size-full rounded-full object-cover"
          src={avatarUrl}
        />
      ) : null}
      <AvatarFallback
        className={cn(buildAvatarTone(name), "font-semibold", fallbackClassName)}
      >
        {buildInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
