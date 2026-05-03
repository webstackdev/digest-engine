import { AppShell } from "@/components/layout/AppShell"
import {
  getProjectEntities,
  getProjectEntityCandidates,
  getProjects,
} from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

import { EntitiesPageContent } from "./_components/EntitiesPageContent"

type EntitiesPageProps = {
  /** Search params promise containing the optional `project`, `error`, and `message` values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the entity management page for the selected project.
 *
 * This page resolves the active project from the URL, loads the project-scoped entity
 * list, and renders both the create form and update/delete controls for existing entities.
 * When no project is available for the configured API user, it returns a guarded empty
 * state instead of issuing any project-scoped entity requests.
 */
export default async function EntitiesPage({
  searchParams,
}: EntitiesPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Entities"
        description="No project found for this API user."
        projects={[]}
        selectedProjectId={null}
      >
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const entities = await getProjectEntities(selectedProject.id)
  const entityCandidates = await getProjectEntityCandidates(selectedProject.id)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <EntitiesPageContent
      entities={entities}
      entityCandidates={entityCandidates}
      errorMessage={errorMessage}
      projects={projects}
      selectedProjectId={selectedProject.id}
      successMessage={successMessage}
    />
  )
}
