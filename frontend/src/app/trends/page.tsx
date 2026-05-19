import { TrendsPageContent } from "@/app/trends/_components/TrendsPageContent"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getProjectContents,
  getProjects,
  getProjectTopicCluster,
  getProjectTopicClusters,
} from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type TrendsPageProps = {
  /** Search params promise containing the optional `project`, `source`, `days`, and `cluster` selectors. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the trends workspace for the selected project.
 */
export default async function TrendsPage({ searchParams }: TrendsPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Trends"
        description="No project found for this API user."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-3xl border-trim-offset bg-page-offset">
          <AlertDescription>Create a project first in Django admin.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const [clusters, contents] = await Promise.all([
    getProjectTopicClusters(selectedProject.id),
    getProjectContents(selectedProject.id),
  ])
  const clusterDetails = await Promise.all(
    clusters.map((cluster) => getProjectTopicCluster(selectedProject.id, cluster.id)),
  )
  const contentMap = new Map(contents.map((content) => [content.id, content]))
  const sourceFilter = String(resolvedSearchParams.source || "")
  const parsedDays = Number.parseInt(String(resolvedSearchParams.days || "14"), 10)
  const daysFilter = Number.isNaN(parsedDays) ? 14 : parsedDays
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - daysFilter)
  const availableSources = Array.from(
    new Set(contents.map((content) => content.source_plugin)),
  ).sort()
  const filteredClusterDetails = clusterDetails.filter((clusterDetail) => {
    const memberContents = clusterDetail.memberships
      .map((membership) => contentMap.get(membership.content.id))
      .filter((content) => Boolean(content))

    if (memberContents.length === 0) {
      return false
    }

    const matchesSource =
      !sourceFilter ||
      memberContents.some((content) => content?.source_plugin === sourceFilter)
    const matchesWindow = memberContents.some(
      (content) =>
        content && new Date(content.published_date).getTime() >= thresholdDate.getTime(),
    )

    return matchesSource && matchesWindow
  })
  const selectedClusterId = Number.parseInt(
    String(resolvedSearchParams.cluster || filteredClusterDetails[0]?.id || "0"),
    10,
  )
  const selectedCluster =
    filteredClusterDetails.find((cluster) => cluster.id === selectedClusterId) ??
    filteredClusterDetails[0] ??
    null
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const averageVelocityScore =
    filteredClusterDetails.length > 0
      ? filteredClusterDetails.reduce(
          (total, cluster) => total + (cluster.velocity_score ?? 0),
          0,
        ) / filteredClusterDetails.length
      : null

  return (
    <TrendsPageContent
      projects={projects}
      selectedProject={selectedProject}
      filteredClusterDetails={filteredClusterDetails}
      selectedCluster={selectedCluster}
      contentMap={contentMap}
      availableSources={availableSources}
      sourceFilter={sourceFilter}
      daysFilter={daysFilter}
      averageVelocityScore={averageVelocityScore}
      errorMessage={errorMessage}
      successMessage={successMessage}
    />
  )
}
