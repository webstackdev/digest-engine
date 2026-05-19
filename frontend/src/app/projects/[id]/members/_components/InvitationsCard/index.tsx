import { CopyButton } from "@/components/elements/CopyButton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { MembershipInvitation } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/view-helpers"

type InvitationsCardProps = {
  invitations: MembershipInvitation[]
  projectId: number
  redirectTarget: string
}

function getInvitationStatus(invitation: MembershipInvitation) {
  if (invitation.revoked_at) {
    return { label: "revoked", variant: "destructive" as const }
  }

  if (invitation.accepted_at) {
    return { label: "accepted", variant: "outline" as const }
  }

  return { label: "pending", variant: "secondary" as const }
}

/** Render invitation history and revocation actions for the project. */
export function InvitationsCard({
  invitations,
  projectId,
  redirectTarget,
}: InvitationsCardProps) {
  return (
    <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending access</p>
          <h3 className="m-0 font-display text-title-sm font-bold text-content-active">Invitations</h3>
        </div>
        {invitations.length === 0 ? (
          <Alert className="rounded-3xl border-trim-offset bg-page-offset">
            <AlertDescription>No active or historical invitations yet.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => {
              const status = getInvitationStatus(invitation)

              return (
                <article
                  className="grid gap-4 rounded-2xl border border-trim-offset bg-page-offset p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  key={invitation.id}
                >
                  <div className="space-y-2">
                    <div>
                      <p className="m-0 text-sm font-semibold text-content-active">{invitation.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full px-3 py-1 text-sm" variant="outline">
                          {invitation.role}
                        </Badge>
                        <Badge className="rounded-full px-3 py-1 text-sm" variant={status.variant}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="m-0 mt-2 text-sm text-content-offset">
                        Invited by {invitation.invited_by_email || "system"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-eyebrow text-content-offset">
                      <span>Created {formatDate(invitation.created_at)}</span>
                      {invitation.accepted_at ? <span>Accepted {formatDate(invitation.accepted_at)}</span> : null}
                      {invitation.revoked_at ? <span>Revoked {formatDate(invitation.revoked_at)}</span> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full px-3")}
                        href={invitation.invite_url}
                      >
                        Open invite link
                      </a>
                      <CopyButton
                        copiedLabel="Invite link copied"
                        label="Copy invite link"
                        value={invitation.invite_url}
                      />
                    </div>
                  </div>
                  {invitation.revoked_at || invitation.accepted_at ? null : (
                    <form action={`/api/projects/${projectId}/invitations/${invitation.id}/revoke`} method="POST">
                      <input name="redirectTo" type="hidden" value={redirectTarget} />
                      <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="destructive">
                        Revoke
                      </Button>
                    </form>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
