import { NewProjectFormCard } from "@/app/admin/projects/new/_components/NewProjectFormCard"
import { ProjectFlashNotice } from "@/app/admin/projects/new/_components/ProjectFlashNotice"
import { AppShell } from "@/components/layout/AppShell"
import { getProjects } from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type NewProjectPageProps = {
  /** Search params promise containing optional flash-message values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the self-service project creation page.
 */
export default async function NewProjectPage({ searchParams }: NewProjectPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <AppShell
      title="Create project"
      description="Spin up a new editorial workspace and become its first project admin automatically."
      projects={projects}
      selectedProjectId={selectedProject?.id ?? null}
    >
      {errorMessage ? (
        <ProjectFlashNotice tone="error">{errorMessage}</ProjectFlashNotice>
      ) : null}
      {successMessage ? (
        <ProjectFlashNotice tone="success">{successMessage}</ProjectFlashNotice>
      ) : null}

      <NewProjectFormCard />
    </AppShell>
  )
}
