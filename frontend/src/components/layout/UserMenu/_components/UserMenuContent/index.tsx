import Link from "next/link"
import { signOut } from "next-auth/react"

import { UserAvatar } from "@/components/elements/UserAvatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type UserMenuContentProps = {
  accountName: string
  accountEmail: string
  isAuthenticated: boolean
  avatarUrl?: string | null
}

/** Render the opened user-menu panel with account details and actions. */
export function UserMenuContent({
  accountName,
  accountEmail,
  isAuthenticated,
  avatarUrl = null,
}: UserMenuContentProps) {
  return (
    <DropdownMenuContent
      align="end"
      className="w-72 rounded-3xl border border-border bg-card p-4 shadow-panel backdrop-blur-xl"
      sideOffset={12}
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          avatarUrl={avatarUrl}
          className="size-12 border border-border shadow-sm after:hidden"
          name={accountName}
        />
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-foreground">{accountName}</p>
          <p className="m-0 truncate text-sm font-normal text-muted">
            {accountEmail || "Signed in account"}
          </p>
        </div>
      </div>

      <DropdownMenuSeparator className="-mx-0 my-4" />

      <div className="grid gap-2">
        <Link
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "min-h-11 justify-center rounded-full px-4 py-3",
          )}
          href="/profile"
        >
          View profile
        </Link>
        <div className="rounded-2xl border border-border bg-muted px-4 py-3 text-sm leading-6 text-muted">
          Update your avatar, display name, and timezone from the profile workspace.
        </div>
      </div>

      {isAuthenticated ? (
        <Button
          className="mt-4 min-h-11 w-full rounded-full px-4 py-3"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          size="lg"
          type="button"
          variant="outline"
        >
          Log out
        </Button>
      ) : (
        <p className="mt-4 mb-0 text-sm leading-6 text-muted">
          No active NextAuth session was found for this browser.
        </p>
      )}
    </DropdownMenuContent>
  )
}
