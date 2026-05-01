import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjects,
  getProjectThemeSuggestions,
  getProjectTopicCluster,
  getProjectTopicClusters,
} from "@/lib/api"
import type { ThemeSuggestion, TopicCluster, TopicClusterDetail } from "@/lib/types"
import {
  formatDate,
  formatPercentScore,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type ThemesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const THEME_DISMISSAL_REASONS = [
  "off-topic",
  "already covered",
  "not actionable",
]

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
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
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
        <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending</p>
          <p className="mt-1 text-3xl font-bold">{pendingCount}</p>
          <p className="text-sm leading-6 text-muted">Themes waiting for an editor decision.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Accepted or used</p>
          <p className="mt-1 text-3xl font-bold">{acceptedCount}</p>
          <p className="text-sm leading-6 text-muted">Themes already promoted into downstream editorial work.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Dismissed</p>
          <p className="mt-1 text-3xl font-bold">{dismissedCount}</p>
          <p className="text-sm leading-6 text-muted">Themes the editor intentionally ruled out.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Total themes</p>
          <p className="mt-1 text-3xl font-bold">{themes.length}</p>
          <p className="text-sm leading-6 text-muted">Persisted theme suggestions available for this project.</p>
        </article>
      </section>

      <form className="mb-4 grid gap-4 rounded-3xl border border-ink/12 bg-surface/85 p-[1.1rem] shadow-panel backdrop-blur-xl sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="GET">
        <input type="hidden" name="project" value={selectedProject.id} />
        <div className="grid gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="status">Status</label>
          <select
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
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
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
            Apply filter
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50"
            href={`/themes?project=${selectedProject.id}`}
          >
            Reset
          </Link>
        </div>
      </form>

      <section className="space-y-4">
        {filteredThemes.length === 0 ? (
          <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
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
            <article
              className={`rounded-3xl border p-5 shadow-panel backdrop-blur-xl ${
                isHighlighted ? "border-primary/25 bg-primary/7" : "border-ink/12 bg-surface/85"
              }`}
              key={theme.id}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Theme suggestion</p>
                  <h2 className="font-display text-title-md font-bold text-ink">{theme.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{theme.pitch}</p>
                </div>
                <StatusBadge
                  tone={
                    theme.status === "pending"
                      ? "warning"
                      : theme.status === "dismissed"
                        ? "negative"
                        : "positive"
                  }
                >
                  {theme.status}
                </StatusBadge>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.9fr)]">
                <div className="space-y-4">
                  <div>
                    <p className="m-0 text-sm font-medium text-ink">Why it matters</p>
                    <p className="mt-2 text-sm leading-6 text-muted">{theme.why_it_matters}</p>
                  </div>
                  <div>
                    <p className="m-0 text-sm font-medium text-ink">Suggested angle</p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {theme.suggested_angle || "No suggested angle was returned for this theme."}
                    </p>
                  </div>

                  {clusterDetail?.memberships.length ? (
                    <div>
                      <p className="m-0 text-sm font-medium text-ink">Supporting content preview</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {clusterDetail.memberships.slice(0, 3).map((membership) => (
                          <Link
                            className="inline-flex items-center rounded-full border border-ink/12 bg-surface-strong/55 px-3 py-1 text-sm text-ink transition hover:bg-surface-strong/80"
                            href={`/content/${membership.content.id}?project=${selectedProject.id}`}
                            key={membership.id}
                          >
                            {membership.content.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {theme.promoted_contents.length > 0 ? (
                    <div>
                      <p className="m-0 text-sm font-medium text-ink">Promoted contents</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {theme.promoted_contents.map((content) => (
                          <Link
                            className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-ink transition hover:bg-primary/12"
                            href={`/content/${content.id}?project=${selectedProject.id}`}
                            key={content.id}
                          >
                            {content.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <aside className="space-y-4 rounded-panel bg-ink/6 px-4 py-4">
                  <div>
                    <p className="m-0 text-sm font-medium text-ink">Cluster</p>
                    {theme.cluster ? (
                      <Link
                        className="mt-2 inline-flex items-center rounded-full border border-ink/12 bg-surface-strong/55 px-3 py-1 text-sm text-ink transition hover:bg-surface-strong/80"
                        href={`/trends?project=${selectedProject.id}&cluster=${theme.cluster.id}`}
                      >
                        {theme.cluster.label || `Cluster ${theme.cluster.id}`}
                      </Link>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-muted">No cluster is attached to this theme.</p>
                    )}
                    {cluster?.dominant_entity ? (
                      <p className="mt-2 text-sm leading-6 text-muted">
                        Dominant entity: {cluster.dominant_entity.name}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>Created {formatDate(theme.created_at)}</span>
                    <span>Velocity {formatPercentScore(theme.velocity_at_creation)}</span>
                    <span>Novelty {formatPercentScore(theme.novelty_score)}</span>
                  </div>

                  {theme.decided_by_username ? (
                    <p className="text-sm leading-6 text-muted">
                      Decided by {theme.decided_by_username} on {formatDate(theme.decided_at)}
                    </p>
                  ) : null}
                  {theme.dismissal_reason ? (
                    <p className="text-sm leading-6 text-muted">
                      Dismissal reason: {theme.dismissal_reason}
                    </p>
                  ) : null}

                  {theme.status === "pending" ? (
                    <div className="flex flex-wrap items-start gap-3">
                      <form
                        action={`/api/projects/${selectedProject.id}/themes/${theme.id}/accept`}
                        method="POST"
                      >
                        <input type="hidden" name="redirectTo" value={currentPageHref} />
                        <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                          Accept
                        </button>
                      </form>
                      <form
                        action={`/api/projects/${selectedProject.id}/themes/${theme.id}/dismiss`}
                        className="flex flex-wrap items-center gap-3"
                        method="POST"
                      >
                        <input type="hidden" name="redirectTo" value={currentPageHref} />
                        <select
                          className="min-h-11 rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                          defaultValue={THEME_DISMISSAL_REASONS[0]}
                          name="reason"
                        >
                          {THEME_DISMISSAL_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                        <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                          Dismiss
                        </button>
                      </form>
                    </div>
                  ) : null}
                </aside>
              </div>
            </article>
          )
        })}
      </section>
    </AppShell>
  )
}
