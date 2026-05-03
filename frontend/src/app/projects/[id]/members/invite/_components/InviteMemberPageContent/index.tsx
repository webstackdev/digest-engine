import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Project } from "@/lib/types"

import { InviteMemberFormCard } from "../InviteMemberFormCard"

type InviteMemberPageContentProps = {
  projects: Project[]
  selectedProject: Project
  errorMessage?: string
  successMessage?: string
}

/** Render the invite-member page shell for one project. */
export function InviteMemberPageContent({
  projects,
  selectedProject,
  errorMessage = "",
  successMessage = "",
}: InviteMemberPageContentProps) {
  const redirectTarget = `/projects/${selectedProject.id}/members/invite?project=${selectedProject.id}`
  const backHref = `/projects/${selectedProject.id}/members?project=${selectedProject.id}`

  return (
    <AppShell
      title="Invite member"
      description="Send a one-time invitation link that grants project access with a predefined role."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
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

      <InviteMemberFormCard
        backHref={backHref}
        projectId={selectedProject.id}
        redirectTarget={redirectTarget}
      />
    </AppShell>
  )
}