import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { SourceDiversityPanel } from "@/components/source-diversity-panel"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectIngestionRuns,
  getProjects,
  getProjectSourceConfigs,
  getProjectSourceDiversitySnapshots,
  getProjectSourceDiversitySummary,
  getProjectTopicCentroidSnapshots,
  getProjectTopicCentroidSummary,
} from "@/lib/api"
import type {
  HealthStatus,
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
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
 * Map source-diversity summary state onto the shared health badge states.
 *
 * @param summary - Project-level source-diversity payload.
 * @returns The badge state for the source-diversity section.
 */
export function deriveSourceDiversityStatus(
  summary: SourceDiversityObservabilitySummary,
): HealthStatus {
  if (!summary.latest_snapshot) {
    return "idle"
  }
  if ((summary.latest_snapshot.breakdown.alerts ?? []).length > 0) {
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
 * Build sparkline points for top-plugin share across recent source-diversity snapshots.
 *
 * @param snapshots - Persisted source-diversity snapshots for the selected project.
 * @returns SVG polyline points spanning recent source concentration history.
 */
export function buildSourceDiversityTrendPoints(
  snapshots: SourceDiversitySnapshot[],
) {
  if (snapshots.length <= 1) {
    return "0,36 220,36"
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
      const y = 72 - snapshot.top_plugin_share * 72
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
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
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const [
    sourceConfigs,
    ingestionRuns,
    centroidSummary,
    centroidSnapshots,
    sourceDiversitySummary,
    sourceDiversitySnapshots,
  ] = await Promise.all([
    getProjectSourceConfigs(selectedProject.id),
    getProjectIngestionRuns(selectedProject.id),
    getProjectTopicCentroidSummary(selectedProject.id),
    getProjectTopicCentroidSnapshots(selectedProject.id),
    getProjectSourceDiversitySummary(selectedProject.id),
    getProjectSourceDiversitySnapshots(selectedProject.id),
  ])
  const sortedCentroidSnapshots = centroidSnapshots
    .slice()
    .sort(
      (left, right) =>
        new Date(right.computed_at).getTime() - new Date(left.computed_at).getTime(),
    )
  const visibleCentroidSnapshots = sortedCentroidSnapshots.slice(0, 12)
  const centroidDriftTrendPoints = buildCentroidDriftTrendPoints(
    visibleCentroidSnapshots,
  )
  const sortedSourceDiversitySnapshots = sourceDiversitySnapshots
    .slice()
    .sort(
      (left, right) =>
        new Date(right.computed_at).getTime() - new Date(left.computed_at).getTime(),
    )
  const visibleSourceDiversitySnapshots = sortedSourceDiversitySnapshots.slice(0, 12)
  const sourceDiversityTrendPoints = buildSourceDiversityTrendPoints(
    visibleSourceDiversitySnapshots,
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
      <section className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
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
          <div className="rounded-panel bg-muted/60 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Centroid state
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {centroidSummary.latest_snapshot
                ? centroidSummary.latest_snapshot.centroid_active
                  ? "Active"
                  : "Inactive"
                : "Not computed"}
            </p>
          </div>
          <div className="rounded-panel bg-muted/60 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Avg drift vs previous
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatDriftPercent(centroidSummary.avg_drift_from_previous)}
            </p>
          </div>
          <div className="rounded-panel bg-muted/60 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Avg drift vs 7d
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatDriftPercent(centroidSummary.avg_drift_from_week_ago)}
            </p>
          </div>
          <div className="rounded-panel bg-muted/60 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Latest snapshot
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {formatDate(centroidSummary.latest_snapshot?.computed_at ?? null)}
            </p>
          </div>
        </div>

        {visibleCentroidSnapshots.length > 1 ? (
          <Link
            aria-label="Open centroid snapshot history"
            className="mt-4 block rounded-panel bg-muted/60 px-4 py-4 transition hover:bg-muted"
            href={`/admin/health?project=${selectedProject.id}#centroid-snapshot-history`}
          >
            <div className="flex items-center justify-between gap-3 text-sm text-muted">
              <span>Recent drift trend</span>
              <span>Last {visibleCentroidSnapshots.length} snapshots</span>
            </div>
            <svg
              aria-label="Centroid drift trend"
              className="mt-3 h-20 w-full overflow-visible text-foreground"
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
          </Link>
        ) : null}

        {centroidSummary.latest_snapshot ? (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-foreground">
            <span>{centroidSummary.snapshot_count} snapshots</span>
            <span>{centroidSummary.active_snapshot_count} active snapshots</span>
            <span>
              Feedback {centroidSummary.latest_snapshot.feedback_count}
            </span>
            <span>Upvotes {centroidSummary.latest_snapshot.upvote_count}</span>
            <span>Downvotes {centroidSummary.latest_snapshot.downvote_count}</span>
          </div>
        ) : (
          <div className="mt-4 rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No centroid snapshots exist for this project yet.
          </div>
        )}
      </section>

      <section
        className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl"
        id="centroid-snapshot-history"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Centroid snapshot history
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Recent centroid recomputations for this project, including feedback volume and drift between snapshots.
            </p>
          </div>
          <span className="text-sm text-muted">
            Showing {visibleCentroidSnapshots.length} of {centroidSummary.snapshot_count} snapshots
          </span>
        </div>

        {visibleCentroidSnapshots.length === 0 ? (
          <div className="mt-4 rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No centroid snapshot history exists for this project yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border/12 text-sm text-muted">
                  <th className="px-3 py-4 font-medium">Computed</th>
                  <th className="px-3 py-4 font-medium">State</th>
                  <th className="px-3 py-4 font-medium">Feedback</th>
                  <th className="px-3 py-4 font-medium">Drift vs previous</th>
                  <th className="px-3 py-4 font-medium">Drift vs 7d</th>
                </tr>
              </thead>
              <tbody>
                {visibleCentroidSnapshots.map((snapshot) => (
                  <tr
                    key={snapshot.id}
                    className="border-b border-border/12 align-top last:border-b-0"
                  >
                    <td className="px-3 py-4 text-sm text-foreground">
                      {formatDate(snapshot.computed_at)}
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge tone={snapshot.centroid_active ? "positive" : "warning"}>
                        {snapshot.centroid_active ? "active" : "inactive"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-4 text-sm text-foreground">
                      {snapshot.feedback_count} total
                    </td>
                    <td className="px-3 py-4 text-sm text-foreground">
                      {formatDriftPercent(snapshot.drift_from_previous)}
                    </td>
                    <td className="px-3 py-4 text-sm text-foreground">
                      {formatDriftPercent(snapshot.drift_from_week_ago)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SourceDiversityPanel
        statusLabel={sourceDiversitySummary.latest_snapshot ? "tracked" : "idle"}
        statusTone={healthTone(deriveSourceDiversityStatus(sourceDiversitySummary))}
        summary={sourceDiversitySummary}
        trendPoints={sourceDiversityTrendPoints}
        visibleSnapshots={visibleSourceDiversitySnapshots}
      />

      <section className="overflow-hidden rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border/12 text-sm text-muted">
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
                    <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
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
                    className="border-b border-border/12 align-top last:border-b-0"
                  >
                    <td className="px-3 py-4">
                      <strong className="font-medium text-foreground">
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
                    <td className="px-3 py-4 text-sm text-foreground">
                      {formatDate(sourceConfig.last_fetched_at)}
                    </td>
                    <td className="px-3 py-4 text-sm text-foreground">
                      {latestRun
                        ? `${latestRun.status} at ${formatDate(latestRun.started_at)}`
                        : "No runs yet"}
                    </td>
                    <td className="px-3 py-4 text-sm text-foreground">
                      {latestRun
                        ? `${latestRun.items_ingested}/${latestRun.items_fetched}`
                        : "0/0"}
                    </td>
                    <td className="px-3 py-4 text-sm text-foreground">
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
