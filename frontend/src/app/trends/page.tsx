import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectContents,
  getProjects,
  getProjectTopicCluster,
  getProjectTopicClusters,
} from "@/lib/api"
import type { TopicVelocitySnapshot } from "@/lib/types"
import {
  formatDate,
  formatPercentScore,
  formatScore,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
  truncateText,
} from "@/lib/view-helpers"

type TrendsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Build an SVG sparkline from persisted topic velocity snapshots.
 *
 * @param snapshots - Snapshot history for one topic cluster.
 * @returns SVG polyline points spanning the velocity history.
 */
export function buildVelocityTrendPoints(snapshots: TopicVelocitySnapshot[]) {
  if (snapshots.length <= 1) {
    return "0,56 220,56"
  }

  const orderedSnapshots = snapshots
    .slice()
    .sort(
      (left, right) =>
        new Date(left.computed_at).getTime() - new Date(right.computed_at).getTime(),
    )

  return orderedSnapshots
    .map((snapshot, index) => {
      const x = (index / (orderedSnapshots.length - 1)) * 220
      const y = 64 - (snapshot.velocity_score ?? 0) * 56
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

function buildTrendHref(projectId: number, filters: { source: string; days: number }, clusterId: number) {
  const params = new URLSearchParams({
    project: String(projectId),
    days: String(filters.days),
    cluster: String(clusterId),
  })
  if (filters.source) {
    params.set("source", filters.source)
  }
  return `/trends?${params.toString()}`
}

/**
 * Render the trends workspace for the selected project.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `project`, `source`, `days`, and `cluster` selectors.
 * @returns The rendered trends page or the no-project empty state.
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
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
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
    <AppShell
      title="Trend analysis"
      description="Cluster velocity, member content, and editorial context for the topics accelerating inside this project."
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
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Visible clusters</p>
          <p className="mt-1 text-3xl font-bold">{filteredClusterDetails.length}</p>
          <p className="text-sm leading-6 text-muted">Clusters matching the current source and date filters.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Avg velocity</p>
          <p className="mt-1 text-3xl font-bold">{formatPercentScore(averageVelocityScore)}</p>
          <p className="text-sm leading-6 text-muted">Average normalized acceleration across the visible clusters.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Window</p>
          <p className="mt-1 text-3xl font-bold">{daysFilter}d</p>
          <p className="text-sm leading-6 text-muted">Recent member content considered when filtering clusters.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Tracked content</p>
          <p className="mt-1 text-3xl font-bold">{contents.length}</p>
          <p className="text-sm leading-6 text-muted">Project content rows available for cluster drill-down context.</p>
        </article>
      </section>

      <form className="mb-4 grid gap-4 rounded-3xl border border-ink/12 bg-surface/85 p-[1.1rem] shadow-panel backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end" method="GET">
        <input type="hidden" name="project" value={selectedProject.id} />
        <div className="grid gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="source">Source plugin</label>
          <select
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="source"
            name="source"
            defaultValue={sourceFilter}
          >
            <option value="">All sources</option>
            {availableSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="days">Published within</label>
          <select
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="days"
            name="days"
            defaultValue={String(daysFilter)}
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
            Apply filters
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50"
            href={`/trends?project=${selectedProject.id}`}
          >
            Reset
          </Link>
        </div>
      </form>

      <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.65fr)]">
        <div className="space-y-4">
          {filteredClusterDetails.length === 0 ? (
            <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
              No topic clusters matched the current filters.
            </div>
          ) : null}
          {filteredClusterDetails.map((cluster) => {
            const trendHref = buildTrendHref(
              selectedProject.id,
              { source: sourceFilter, days: daysFilter },
              cluster.id,
            )
            const isSelected = selectedCluster?.id === cluster.id

            return (
              <Link
                className={`block rounded-3xl border p-5 shadow-panel backdrop-blur-xl transition hover:-translate-y-0.5 ${
                  isSelected
                    ? "border-primary/25 bg-primary/7"
                    : "border-ink/12 bg-surface/85"
                }`}
                href={trendHref}
                key={cluster.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Cluster</p>
                    <h3 className="font-display text-title-sm font-bold text-ink">
                      {cluster.label || `Cluster ${cluster.id}`}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {cluster.dominant_entity
                        ? `Dominant entity: ${cluster.dominant_entity.name}`
                        : "No dominant entity has been resolved yet."}
                    </p>
                  </div>
                  <StatusBadge tone={(cluster.velocity_score ?? 0) >= 0.7 ? "positive" : "warning"}>
                    {formatPercentScore(cluster.velocity_score)}
                  </StatusBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                  <span>{cluster.member_count} members</span>
                  <span>Z {formatScore(cluster.z_score)}</span>
                  <span>Window {cluster.window_count ?? 0}</span>
                  <span>Last seen {formatDate(cluster.last_seen_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="space-y-4">
          {selectedCluster ? (
            <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Cluster detail</p>
                  <h2 className="font-display text-title-md font-bold text-ink">
                    {selectedCluster.label || `Cluster ${selectedCluster.id}`}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {selectedCluster.dominant_entity
                      ? `${selectedCluster.dominant_entity.name} leads this cluster.`
                      : "This cluster does not have a dominant entity yet."}
                  </p>
                </div>
                <StatusBadge tone={(selectedCluster.velocity_score ?? 0) >= 0.7 ? "positive" : "warning"}>
                  Velocity {formatPercentScore(selectedCluster.velocity_score)}
                </StatusBadge>
              </div>

              {selectedCluster.velocity_history.length > 1 ? (
                <div className="mt-4 rounded-panel bg-ink/6 px-4 py-4">
                  <div className="flex items-center justify-between gap-3 text-sm text-muted">
                    <span>Velocity history</span>
                    <span>{selectedCluster.velocity_history.length} snapshots</span>
                  </div>
                  <svg className="mt-3 h-20 w-full overflow-visible text-ink" role="img" viewBox="0 0 220 72">
                    <polyline
                      fill="none"
                      points={buildVelocityTrendPoints(selectedCluster.velocity_history)}
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedCluster.memberships.map((membership) => {
                  const content = contentMap.get(membership.content.id)

                  return (
                    <article
                      className="rounded-panel border border-ink/12 bg-surface-strong/55 p-4"
                      key={membership.id}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        <span>{membership.content.source_plugin}</span>
                        <span>{formatDate(membership.content.published_date)}</span>
                        <span>Similarity {formatScore(membership.similarity)}</span>
                      </div>
                      <h3 className="mt-3 font-display text-title-sm font-bold text-ink">
                        {membership.content.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {truncateText(content?.content_text || membership.content.title)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
                        <span>
                          Adjusted {formatPercentScore(content?.authority_adjusted_score ?? content?.relevance_score ?? null)}
                        </span>
                        {content?.newsletter_promotion_at ? (
                          <span>
                            Promoted {formatDate(content.newsletter_promotion_at)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Link
                          className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                          href={`/content/${membership.content.id}?project=${selectedProject.id}`}
                        >
                          Open detail
                        </Link>
                        <Link
                          className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50"
                          href={membership.content.url}
                          target="_blank"
                        >
                          Open source
                        </Link>
                      </div>
                    </article>
                  )
                })}
              </div>
            </article>
          ) : (
            <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
              Select a cluster to inspect its member content and velocity history.
            </div>
          )}
        </div>
      </section>
    </AppShell>
  )
}