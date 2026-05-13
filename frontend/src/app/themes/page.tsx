import { ThemesPageContent } from "@/app/themes/_components/ThemesPageContent"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getProjects,
  getProjectThemeSuggestions,
  getProjectTopicCluster,
  getProjectTopicClusters,
} from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type ThemesPageProps = {
  /** Search params promise containing the optional `project`, `status`, and `theme` selectors. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the editor-facing theme queue for the selected project.
 */
export default async function ThemesPage({ searchParams }: ThemesPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Themes"
        description="No project found for this API user."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-panel border-border bg-muted">
          <AlertDescription>Create a project first in Django admin.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const [themes, clusters] = await Promise.all([
    getProjectThemeSuggestions(selectedProject.id),
    getProjectTopicClusters(selectedProject.id),
  ])
  const uniqueClusterIds = Array.from(
    new Set(themes.map((theme) => theme.cluster?.id).filter((value) => Boolean(value))),
  ) as number[]
  const clusterDetails = await Promise.all(
    uniqueClusterIds.map((clusterId) =>
      getProjectTopicCluster(selectedProject.id, clusterId),
    ),
  )
  const selectedThemeId = Number.parseInt(String(resolvedSearchParams.theme || "0"), 10)
  const statusFilter = String(resolvedSearchParams.status || "all")
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <ThemesPageContent
      clusterDetails={clusterDetails}
      clusters={clusters}
      errorMessage={errorMessage}
      projects={projects}
      selectedProject={selectedProject}
      selectedThemeId={selectedThemeId}
      statusFilter={statusFilter}
      successMessage={successMessage}
      themes={themes}
    />
  )
}
