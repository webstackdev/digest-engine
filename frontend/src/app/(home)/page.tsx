import { HomePageContent } from "@/app/(home)/_components/HomePageContent"
import { buildContentClusterLookup } from "@/app/(home)/_components/shared"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getProjectContents,
  getProjectEntities,
  getProjectFeedback,
  getProjectReviewQueue,
  getProjects,
  getProjectSourceConfigs,
  getProjectTopicCluster,
  getProjectTopicClusters,
} from "@/lib/api"
import { buildDashboardView } from "@/lib/dashboard-view"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type HomePageProps = {
  /** Search params promise containing the optional dashboard filters and flash messages. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the project dashboard for the selected API-visible project.
 *
 * The page resolves the active project from the URL, loads the project-scoped content,
 * review queue, entity, source, and feedback data, and then delegates filter and summary
 * derivation to `buildDashboardView`. When the current API user has no visible projects,
 * the page returns a guarded empty state instead of issuing any project-scoped requests.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Dashboard"
        description="Create a project in Django admin first, then come back here to review ingested content."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-3xl border-trim-offset bg-muted">
          <AlertDescription>No projects are available for the configured API user.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const [contents, reviewQueue, entities, sourceConfigs, feedback, topicClusters] =
    await Promise.all([
      getProjectContents(selectedProject.id),
      getProjectReviewQueue(selectedProject.id),
      getProjectEntities(selectedProject.id),
      getProjectSourceConfigs(selectedProject.id),
      getProjectFeedback(selectedProject.id),
      getProjectTopicClusters(selectedProject.id),
    ])
  const clusterDetails = await Promise.all(
    topicClusters.map((cluster) => getProjectTopicCluster(selectedProject.id, cluster.id)),
  )
  const contentClusterLookup = buildContentClusterLookup(clusterDetails)

  const {
    contentMap,
    contentTypeFilter,
    contentTypes,
    daysFilter,
    duplicateStateFilter,
    filteredContents,
    negativeFeedback,
    pendingReviewItems,
    positiveFeedback,
    sourceFilter,
    sources,
    view,
  } = buildDashboardView({
    contents,
    reviewQueue,
    feedback,
    searchParams: resolvedSearchParams,
  })
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <HomePageContent
      contentClusterLookup={contentClusterLookup}
      contentMap={contentMap}
      contentTypeFilter={contentTypeFilter}
      contentTypes={contentTypes}
      daysFilter={daysFilter}
      duplicateStateFilter={duplicateStateFilter}
      entities={entities}
      errorMessage={errorMessage}
      filteredContents={filteredContents}
      negativeFeedback={negativeFeedback}
      pendingReviewItems={pendingReviewItems}
      positiveFeedback={positiveFeedback}
      projects={projects}
      selectedProject={selectedProject}
      sourceConfigs={sourceConfigs}
      sourceFilter={sourceFilter}
      sources={sources}
      successMessage={successMessage}
      view={view}
    />
  )
}
