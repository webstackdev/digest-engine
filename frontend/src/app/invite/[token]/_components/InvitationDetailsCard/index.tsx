import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { PublicMembershipInvitation } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDisplayLabel } from "@/lib/view-helpers"

type InvitationDetailsCardProps = {
  invitation: PublicMembershipInvitation
  token: string
  isAuthenticated: boolean
}

/** Render one public invitation payload and the next available action. */
export function InvitationDetailsCard({
  invitation,
  token,
  isAuthenticated,
}: InvitationDetailsCardProps) {
  const callbackUrl = `/invite/${token}`

  return (
    <Card className="rounded-3xl border border-trim-offset bg-muted shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="m-0 text-sm text-muted">Project</p>
            <h2 className="m-0 font-display text-title-sm font-bold text-content-active">
              {invitation.project_name}
            </h2>
          </div>
          <Badge
            className="rounded-full px-3 py-1 text-sm capitalize"
            variant={invitation.status === "pending" ? "secondary" : "outline"}
          >
            {formatDisplayLabel(invitation.status)}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="m-0 text-sm text-muted">Invited email</p>
            <p className="m-0 text-sm font-medium text-content-active">{invitation.email}</p>
          </div>
          <div>
            <p className="m-0 text-sm text-muted">Role</p>
            <p className="m-0 text-sm font-medium text-content-active">{formatDisplayLabel(invitation.role)}</p>
          </div>
        </div>

        {invitation.status === "revoked" ? (
          <p className="m-0 text-sm leading-6 text-destructive">This invitation has been revoked.</p>
        ) : invitation.status === "accepted" ? (
          <p className="m-0 text-sm leading-6 text-muted">This invitation has already been accepted.</p>
        ) : isAuthenticated ? (
          <form action={`/api/invitations/${token}/accept`} method="POST">
            <input name="redirectTo" type="hidden" value={callbackUrl} />
            <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
              Accept invitation
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="m-0 text-sm leading-6 text-muted">
              Sign in as {invitation.email} to accept this invitation.
            </p>
            <Link
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 rounded-full px-4 py-3")}
              href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            >
              Sign in to continue
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
