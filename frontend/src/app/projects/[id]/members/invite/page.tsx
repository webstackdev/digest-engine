import { InviteMemberPageContent } from "@/app/projects/[id]/members/invite/_components/InviteMemberPageContent"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getProjects } from "@/lib/api"
import { getErrorMessage, getSuccessMessage } from "@/lib/view-helpers"

type InviteMemberPageProps = {
  /** Route params promise containing the project id. */
  params: Promise<{ id: string }>
  /** Search params promise containing optional flash-message values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the invitation composer for one project roster.
 */
export default async function InviteMemberPage({ params, searchParams }: InviteMemberPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const projectId = Number.parseInt(id, 10)
  const projects = await getProjects()
  const selectedProject = projects.find((project) => project.id === projectId) ?? null
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Invite member"
        description="That project is not available for the current API user."
        projects={projects}
        selectedProjectId={null}
      >
        <Alert className="rounded-panel border-border bg-muted">
          <AlertDescription>Select a visible project first.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  if (selectedProject.user_role !== "admin") {
    return (
      <AppShell
        title="Invite member"
        description="Only project admins can invite new members."
        projects={projects}
        selectedProjectId={selectedProject.id}
      >
        <Alert className="rounded-panel border-destructive bg-destructive" variant="destructive">
          <AlertDescription>You need the admin role on this project to invite new members.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  return (
    <InviteMemberPageContent
      errorMessage={errorMessage}
      projects={projects}
      selectedProject={selectedProject}
      successMessage={successMessage}
    />
  )
}
