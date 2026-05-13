import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getProjectConfig,
  getProjectEntities,
  getProjectEntity,
  getProjectEntityAuthorityComponents,
  getProjectEntityAuthorityHistory,
  getProjectEntityMentions,
  getProjects,
} from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

import { EntityDetailPageContent } from "./_components/EntityDetailPageContent"

type EntityDetailPageProps = {
  /** Route params promise containing the entity id. */
  params: Promise<{ id: string }>
  /** Search params promise containing the optional `project`, `error`, and `message` values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the detail view for one tracked entity in the selected project.
 *
 * The page joins the entity record with its current authority breakdown, historical
 * snapshots, and extracted mention history so editors can inspect how the pipeline is
 * linking content and weighting authority over time.
 */
export default async function EntityDetailPage({
  params,
  searchParams,
}: EntityDetailPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Entity detail"
        description="No project is available for the configured API user."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-panel border-border bg-muted">
          <AlertDescription>Create a project first in Django admin.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const entityId = Number.parseInt(id, 10)
  const [
    entity,
    mentions,
    authorityComponents,
    authorityHistory,
    projectEntities,
    projectConfig,
  ] = await Promise.all([
    getProjectEntity(selectedProject.id, entityId),
    getProjectEntityMentions(selectedProject.id, entityId),
    getProjectEntityAuthorityComponents(selectedProject.id, entityId).catch(
      () => null,
    ),
    getProjectEntityAuthorityHistory(selectedProject.id, entityId),
    getProjectEntities(selectedProject.id),
    selectedProject.user_role === "admin"
      ? getProjectConfig(selectedProject.id)
      : Promise.resolve(null),
  ])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const siblingEntities = projectEntities.filter((candidate) => candidate.id !== entity.id)

  return (
    <EntityDetailPageContent
      authorityComponents={authorityComponents}
      authorityHistory={authorityHistory}
      entity={entity}
      errorMessage={errorMessage}
      mentions={mentions}
      projectConfig={projectConfig}
      projects={projects}
      selectedProject={selectedProject}
      siblingEntities={siblingEntities}
      successMessage={successMessage}
    />
  )
}
