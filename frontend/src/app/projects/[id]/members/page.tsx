import { MembersPageContent } from "@/app/projects/[id]/members/_components/MembersPageContent"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getCurrentUserProfile,
  getProjectInvitations,
  getProjectMemberships,
  getProjects,
} from "@/lib/api"
import { getErrorMessage, getSuccessMessage } from "@/lib/view-helpers"

type MembersPageProps = {
  /** Route params promise containing the project id. */
  params: Promise<{ id: string }>
  /** Search params promise containing optional flash-message values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the project membership-management page for one selected project.
 */
export default async function MembersPage({ params, searchParams }: MembersPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const projectId = Number.parseInt(id, 10)
  const projects = await getProjects()
  const selectedProject = projects.find((project) => project.id === projectId) ?? null
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Members"
        description="That project is not available for the current API user."
        projects={projects}
        selectedProjectId={null}
      >
        <Alert className="rounded-3xl border-trim-offset bg-page-offset">
          <AlertDescription>Select a visible project first.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  if (selectedProject.user_role !== "admin") {
    return (
      <AppShell
        title="Members"
        description="Only project admins can manage roster and invitation settings."
        projects={projects}
        selectedProjectId={selectedProject.id}
      >
        <Alert className="rounded-3xl border-danger bg-danger" variant="destructive">
          <AlertDescription>You need the admin role on this project to manage members.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const [currentUser, memberships, invitations] = await Promise.all([
    getCurrentUserProfile(),
    getProjectMemberships(selectedProject.id),
    getProjectInvitations(selectedProject.id),
  ])
  return (
    <MembersPageContent
      currentUserId={currentUser.id}
      errorMessage={errorMessage}
      invitations={invitations}
      memberships={memberships}
      projects={projects}
      selectedProject={selectedProject}
      successMessage={successMessage}
    />
  )
}
