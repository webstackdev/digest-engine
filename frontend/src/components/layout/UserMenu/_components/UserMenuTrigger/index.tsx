import { UserAvatar } from "@/components/elements/UserAvatar"
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type UserMenuTriggerProps = {
  accountName: string
  avatarUrl?: string | null
}

/** Render the dropdown trigger for the shared user menu. */
export function UserMenuTrigger({
  accountName,
  avatarUrl = null,
}: UserMenuTriggerProps) {
  return (
    <DropdownMenuTrigger
      aria-label="Open user menu"
      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/10 bg-card/85 p-0 shadow-sm transition hover:brightness-105"
    >
      <UserAvatar
        avatarUrl={avatarUrl}
        className="size-12 border-none after:hidden"
        name={accountName}
      />
    </DropdownMenuTrigger>
  )
}
