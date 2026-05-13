import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Project, ThemeSuggestion, TopicCluster, TopicClusterDetail } from "@/lib/types"

import { DEFAULT_THEME_DISMISSAL_REASONS } from "../shared"
import { ThemesFilterToolbar } from "../ThemesFilterToolbar"
import { ThemesQueueOverview } from "../ThemesQueueOverview"
import { ThemeSuggestionCard } from "../ThemeSuggestionCard"

type ThemesPageContentProps = {
  projects: Project[]
  selectedProject: Project
  themes: ThemeSuggestion[]
  clusters: TopicCluster[]
  clusterDetails: TopicClusterDetail[]
  statusFilter: string
  selectedThemeId: number
  errorMessage?: string
  successMessage?: string
}

function buildThemePageHref(projectId: number, statusFilter: string) {
  const params = new URLSearchParams({ project: String(projectId) })
  if (statusFilter && statusFilter !== "all") {
    params.set("status", statusFilter)
  }
  return `/themes?${params.toString()}`
}

function buildThemeClusterMaps(
  clusters: TopicCluster[],
  clusterDetails: TopicClusterDetail[],
) {
  return {
    clustersById: new Map(clusters.map((cluster) => [cluster.id, cluster])),
    clusterDetailsById: new Map(
      clusterDetails.map((clusterDetail) => [clusterDetail.id, clusterDetail]),
    ),
  }
}

function filterThemes(themes: ThemeSuggestion[], statusFilter: string) {
  if (!statusFilter || statusFilter === "all") {
    return themes
  }
  return themes.filter((theme) => theme.status === statusFilter)
}

/** Render the editor-facing theme queue for one selected project. */
export function ThemesPageContent({
  projects,
  selectedProject,
  themes,
  clusters,
  clusterDetails,
  statusFilter,
  selectedThemeId,
  errorMessage = "",
  successMessage = "",
}: ThemesPageContentProps) {
  const { clustersById, clusterDetailsById } = buildThemeClusterMaps(
    clusters,
    clusterDetails,
  )
  const filteredThemes = filterThemes(themes, statusFilter).slice().sort((left, right) => {
    if (left.id === selectedThemeId) {
      return -1
    }
    if (right.id === selectedThemeId) {
      return 1
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
  const pendingCount = themes.filter((theme) => theme.status === "pending").length
  const acceptedCount = themes.filter(
    (theme) => theme.status === "accepted" || theme.status === "used",
  ).length
  const dismissedCount = themes.filter((theme) => theme.status === "dismissed").length
  const currentPageHref = buildThemePageHref(selectedProject.id, statusFilter)

  return (
    <AppShell
      title="Theme queue"
      description="Review velocity-derived theme suggestions, accept the ones worth promoting, and record structured feedback on the rest."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <Alert className="rounded-panel border-destructive bg-destructive" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert className="rounded-panel border-border bg-muted">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <ThemesQueueOverview
        acceptedCount={acceptedCount}
        dismissedCount={dismissedCount}
        pendingCount={pendingCount}
        totalCount={themes.length}
      />

      <ThemesFilterToolbar projectId={selectedProject.id} statusFilter={statusFilter} />

      <section className="space-y-4">
        {filteredThemes.length === 0 ? (
          <Alert className="rounded-panel border-border bg-muted">
            <AlertDescription>
              No theme suggestions matched the current filter. If the queue stays empty, check the cluster velocity thresholds and nightly theme-generation caps.
            </AlertDescription>
          </Alert>
        ) : null}
        {filteredThemes.map((theme) => {
          const cluster = theme.cluster ? clustersById.get(theme.cluster.id) ?? null : null
          const clusterDetail = theme.cluster
            ? clusterDetailsById.get(theme.cluster.id) ?? null
            : null
          const isHighlighted = theme.id === selectedThemeId

          return (
            <ThemeSuggestionCard
              cluster={cluster}
              clusterDetail={clusterDetail}
              currentPageHref={currentPageHref}
              dismissalReasons={DEFAULT_THEME_DISMISSAL_REASONS}
              isHighlighted={isHighlighted}
              key={theme.id}
              projectId={selectedProject.id}
              theme={theme}
            />
          )
        })}
      </section>
    </AppShell>
  )
}
