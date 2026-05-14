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
        <Alert className="rounded-3xl border-danger bg-danger" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert className="rounded-3xl border-trim-offset bg-page-offset">
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
