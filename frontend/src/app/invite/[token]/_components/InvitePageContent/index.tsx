import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import type { PublicMembershipInvitation } from "@/lib/types"

import { InvitationDetailsCard } from "../InvitationDetailsCard"

type InvitePageContentProps = {
  token: string
  invitation: PublicMembershipInvitation | null
  invitationError?: string
  errorMessage?: string
  successMessage?: string
  isAuthenticated: boolean
}

/** Render the public invitation shell, flash messages, and invitation card. */
export function InvitePageContent({
  token,
  invitation,
  invitationError = "",
  errorMessage = "",
  successMessage = "",
  isAuthenticated,
}: InvitePageContentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl rounded-3xl border border-border/12 bg-card/90 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-6 pt-4 md:pt-6">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow text-muted">
              Newsletter Maker
            </p>
            <h1 className="mt-2 font-display text-display-page font-bold text-foreground">
              Project invitation
            </h1>
          </div>

          {errorMessage ? (
            <Alert className="rounded-panel border-destructive/20 bg-destructive/10" variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          {successMessage ? (
            <Alert className="rounded-panel border-border/10 bg-muted/60">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          ) : null}
          {invitationError ? (
            <Alert className="rounded-panel border-destructive/20 bg-destructive/10" variant="destructive">
              <AlertDescription>{invitationError}</AlertDescription>
            </Alert>
          ) : null}

          {invitation ? (
            <InvitationDetailsCard
              invitation={invitation}
              isAuthenticated={isAuthenticated}
              token={token}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
