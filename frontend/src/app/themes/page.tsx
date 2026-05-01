import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import {
  DEFAULT_THEME_DISMISSAL_REASONS,
  ThemeSuggestionCard,
} from "@/components/theme-suggestion-card"
import {
  getProjects,
  getProjectThemeSuggestions,
  getProjectTopicCluster,
  getProjectTopicClusters,
} from "@/lib/api"
import type { ThemeSuggestion, TopicCluster, TopicClusterDetail } from "@/lib/types"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type ThemesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
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

/**
 * Render the editor-facing theme queue for the selected project.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `project`, `status`, and `theme` selectors.
 * @returns The rendered themes page or the no-project empty state.
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
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
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
  const { clustersById, clusterDetailsById } = buildThemeClusterMaps(
    clusters,
    clusterDetails,
  )
  const selectedThemeId = Number.parseInt(String(resolvedSearchParams.theme || "0"), 10)
  const statusFilter = String(resolvedSearchParams.status || "all")
  const filteredThemes = filterThemes(themes, statusFilter).slice().sort((left, right) => {
    if (left.id === selectedThemeId) {
      return -1
    }
    if (right.id === selectedThemeId) {
      return 1
    }
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
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
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending</p>
          <p className="mt-1 text-3xl font-bold">{pendingCount}</p>
          <p className="text-sm leading-6 text-muted">Themes waiting for an editor decision.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Accepted or used</p>
          <p className="mt-1 text-3xl font-bold">{acceptedCount}</p>
          <p className="text-sm leading-6 text-muted">Themes already promoted into downstream editorial work.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Dismissed</p>
          <p className="mt-1 text-3xl font-bold">{dismissedCount}</p>
          <p className="text-sm leading-6 text-muted">Themes the editor intentionally ruled out.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Total themes</p>
          <p className="mt-1 text-3xl font-bold">{themes.length}</p>
          <p className="text-sm leading-6 text-muted">Persisted theme suggestions available for this project.</p>
        </article>
      </section>

      <form className="mb-4 grid gap-4 rounded-3xl border border-border/12 bg-card/85 p-[1.1rem] shadow-panel backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="GET">
        <input type="hidden" name="project" value={selectedProject.id} />
        <div className="grid gap-2">
          <label className="text-sm font-medium text-foreground" htmlFor="status">Status</label>
          <select
            className="w-full rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            defaultValue={statusFilter}
            id="status"
            name="status"
          >
            <option value="all">All themes</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="used">Used</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
            Apply filter
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            href={`/themes?project=${selectedProject.id}`}
          >
            Reset
          </Link>
        </div>
      </form>

      <section className="space-y-4">
        {filteredThemes.length === 0 ? (
          <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No theme suggestions matched the current filter. If the queue stays empty, check the cluster velocity thresholds and nightly theme-generation caps.
          </div>
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
