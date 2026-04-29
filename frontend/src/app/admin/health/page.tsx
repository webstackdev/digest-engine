import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectIngestionRuns,
  getProjects,
  getProjectSourceConfigs,
  getProjectTopicCentroidSummary,
  getProjectTopicCentroidSnapshots,
} from "@/lib/api"
import type {
  HealthStatus,
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
} from "@/lib/types"
import { formatDate, healthTone, selectProject } from "@/lib/view-helpers"

type HealthPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Classify a source configuration into the badge status shown on the admin health page.
 *
 * The page treats disabled sources as idle, active sources with failed or currently
 * running ingestion as unhealthy, and sources with no fetch timestamp as degraded so
 * operators can spot missing history before the source silently stalls.
 *
 * @param isActive - Whether the source configuration is enabled for ingestion.
 * @param latestRunStatus - Status of the newest ingestion run for the same plugin, or `null` when no run exists.
 * @param lastFetchedAt - ISO timestamp for the last successful fetch, or `null` when the source has not fetched yet.
 * @returns The health badge state for the source row.
 */
export function deriveSourceStatus(
  isActive: boolean,
  latestRunStatus: string | null,
  lastFetchedAt: string | null,
): HealthStatus {
  if (!isActive) {
    return "idle"
  }
  if (latestRunStatus === "failed") {
    return "failing"
  }
  if (latestRunStatus === "running") {
    return "degraded"
  }
  if (!lastFetchedAt) {
    return "degraded"
  }
  return "healthy"
}

/**
 * Map centroid summary state onto the shared health badge states.
 *
 * Projects with no centroid snapshots are idle, inactive latest snapshots are
 * degraded, and active latest snapshots are healthy.
 *
 * @param summary - Project-level centroid observability payload.
 * @returns The badge state for the centroid section.
 */
export function deriveCentroidStatus(
  summary: TopicCentroidObservabilitySummary,
): HealthStatus {
  if (!summary.latest_snapshot) {
    return "idle"
  }
  if (!summary.latest_snapshot.centroid_active) {
    return "degraded"
  }
  return "healthy"
}

/**
 * Format a centroid drift value as a one-decimal percentage.
 *
 * @param value - Normalized cosine-distance drift or `null` when unavailable.
 * @returns Percentage text or `n/a`.
 */
export function formatDriftPercent(value: number | null) {
  if (value === null) {
    return "n/a"
  }
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Build sparkline points for centroid drift across recent snapshots.
 *
 * @param snapshots - Persisted centroid snapshots for the selected project.
 * @returns SVG polyline points spanning the recent drift history.
 */
export function buildCentroidDriftTrendPoints(
  snapshots: TopicCentroidSnapshot[],
) {
  if (snapshots.length <= 1) {
    return "0,36 220,36"
  }

  const points = snapshots
    .slice()
    .sort(
      (left, right) =>
        new Date(left.computed_at).getTime() - new Date(right.computed_at).getTime(),
    )
    .map((snapshot, index, orderedSnapshots) => {
      const x = (index / (orderedSnapshots.length - 1)) * 220
      const drift = snapshot.drift_from_previous ?? 0
      const y = 72 - drift * 72
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

  return points.join(" ")
}

/**
 * Render the source-by-source ingestion health view for the selected project.
 *
 * The page resolves the active project from the URL search params, loads source
 * configurations and their most recent ingestion runs, and then maps those records to
 * a compact health table. When the API user has no available project, the page renders
 * a safe empty state instead of attempting project-scoped API calls.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `project` selector.
 * @returns The rendered admin health page for the selected project or the empty project state.
 */
export default async function HealthPage({ searchParams }: HealthPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Health"
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

  const [sourceConfigs, ingestionRuns, centroidSummary, centroidSnapshots] = await Promise.all([
    getProjectSourceConfigs(selectedProject.id),
    getProjectIngestionRuns(selectedProject.id),
    getProjectTopicCentroidSummary(selectedProject.id),
    getProjectTopicCentroidSnapshots(selectedProject.id),
  ])
  const centroidDriftTrendPoints = buildCentroidDriftTrendPoints(
    centroidSnapshots.slice(0, 12),
  )

  const latestRunByPlugin = new Map<string, (typeof ingestionRuns)[number]>()
  for (const ingestionRun of ingestionRuns) {
    if (!latestRunByPlugin.has(ingestionRun.plugin_name)) {
      latestRunByPlugin.set(ingestionRun.plugin_name, ingestionRun)
    }
  }

  return (
    <AppShell
      title="Ingestion health"
      description="A source-by-source view of freshness, last run outcome, and whether the pipeline is idle, healthy, or failing."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      <section className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Topic centroid observability
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              The latest centroid state for this project, plus average drift across
              persisted snapshot history.
            </p>
          </div>
          <StatusBadge tone={healthTone(deriveCentroidStatus(centroidSummary))}>
            {centroidSummary.latest_snapshot
              ? centroidSummary.latest_snapshot.centroid_active
                ? "active"
                : "inactive"
              : "idle"}
          </StatusBadge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-panel bg-ink/6 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Centroid state
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {centroidSummary.latest_snapshot
                ? centroidSummary.latest_snapshot.centroid_active
                  ? "Active"
                  : "Inactive"
                : "Not computed"}
            </p>
          </div>
          <div className="rounded-panel bg-ink/6 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Avg drift vs previous
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {formatDriftPercent(centroidSummary.avg_drift_from_previous)}
            </p>
          </div>
          <div className="rounded-panel bg-ink/6 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Avg drift vs 7d
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {formatDriftPercent(centroidSummary.avg_drift_from_week_ago)}
            </p>
          </div>
          <div className="rounded-panel bg-ink/6 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Latest snapshot
            </p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {formatDate(centroidSummary.latest_snapshot?.computed_at ?? null)}
            </p>
          </div>
        </div>

        {centroidSnapshots.length > 1 ? (
          <div className="mt-4 rounded-panel bg-ink/6 px-4 py-4">
            <div className="flex items-center justify-between gap-3 text-sm text-muted">
              <span>Recent drift trend</span>
              <span>Last {Math.min(centroidSnapshots.length, 12)} snapshots</span>
            </div>
            <svg
              aria-label="Centroid drift trend"
              className="mt-3 h-20 w-full overflow-visible text-ink"
              role="img"
              viewBox="0 0 220 72"
            >
              <polyline
                fill="none"
                points={centroidDriftTrendPoints}
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
          </div>
        ) : null}

        {centroidSummary.latest_snapshot ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink">
            <span>{centroidSummary.snapshot_count} snapshots</span>
            <span>{centroidSummary.active_snapshot_count} active snapshots</span>
            <span>
              Feedback {centroidSummary.latest_snapshot.feedback_count}
            </span>
            <span>Upvotes {centroidSummary.latest_snapshot.upvote_count}</span>
            <span>Downvotes {centroidSummary.latest_snapshot.downvote_count}</span>
          </div>
        ) : (
          <div className="mt-4 rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
            No centroid snapshots exist for this project yet.
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/12 text-sm text-muted">
                <th className="px-3 py-4 font-medium">Source</th>
                <th className="px-3 py-4 font-medium">Status</th>
                <th className="px-3 py-4 font-medium">Last fetch</th>
                <th className="px-3 py-4 font-medium">Latest run</th>
                <th className="px-3 py-4 font-medium">Items</th>
                <th className="px-3 py-4 font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {sourceConfigs.length === 0 ? (
                <tr>
                  <td className="px-3 py-4" colSpan={6}>
                    <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
                      No source configurations exist for this project yet.
                    </div>
                  </td>
                </tr>
              ) : null}
              {sourceConfigs.map((sourceConfig) => {
                const latestRun =
                  latestRunByPlugin.get(sourceConfig.plugin_name) ?? null
                const status = deriveSourceStatus(
                  sourceConfig.is_active,
                  latestRun?.status ?? null,
                  sourceConfig.last_fetched_at,
                )
                return (
                  <tr
                    key={sourceConfig.id}
                    className="border-b border-ink/12 align-top last:border-b-0"
                  >
                    <td className="px-3 py-4">
                      <strong className="font-medium text-ink">
                        {sourceConfig.plugin_name}
                      </strong>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                        <span>Config #{sourceConfig.id}</span>
                        <span>
                          {sourceConfig.is_active ? "active" : "disabled"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge tone={healthTone(status)}>
                        {status}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-4 text-sm text-ink">
                      {formatDate(sourceConfig.last_fetched_at)}
                    </td>
                    <td className="px-3 py-4 text-sm text-ink">
                      {latestRun
                        ? `${latestRun.status} at ${formatDate(latestRun.started_at)}`
                        : "No runs yet"}
                    </td>
                    <td className="px-3 py-4 text-sm text-ink">
                      {latestRun
                        ? `${latestRun.items_ingested}/${latestRun.items_fetched}`
                        : "0/0"}
                    </td>
                    <td className="px-3 py-4 text-sm text-ink">
                      {latestRun?.error_message || "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}
