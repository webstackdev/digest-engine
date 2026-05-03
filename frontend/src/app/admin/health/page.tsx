import { SourceDiversityPanel } from "@/app/admin/health/_components/SourceDiversityPanel"
import { SourceHealthPanel } from "@/app/admin/health/_components/SourceHealthPanel"
import { TopicCentroidPanel } from "@/app/admin/health/_components/TopicCentroidPanel"
import { TrendTaskRunsPanel } from "@/app/admin/health/_components/TrendTaskRunsPanel"
import { AppShell } from "@/components/layout/AppShell"
import {
  getProjectIngestionRuns,
  getProjects,
  getProjectSourceConfigs,
  getProjectSourceDiversitySnapshots,
  getProjectSourceDiversitySummary,
  getProjectTopicCentroidSnapshots,
  getProjectTopicCentroidSummary,
  getProjectTrendTaskRuns,
  getProjectTrendTaskRunSummary,
} from "@/lib/api"
import type {
  HealthStatus,
  IngestionRun,
  SourceConfig,
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
  TrendTaskRunObservabilitySummary,
} from "@/lib/types"
import { healthTone, selectProject } from "@/lib/view-helpers"

type HealthPageProps = {
  /** Search params promise containing the optional `project` selector. */
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
 * Map trend task run summaries onto the shared health badge states.
 *
 * @param summary - Project-level trend pipeline run payload.
 * @returns The badge state for the trend pipeline section.
 */
export function deriveTrendTaskRunStatus(
  summary: TrendTaskRunObservabilitySummary,
): HealthStatus {
  if (summary.latest_runs.length === 0) {
    return "idle"
  }
  if (summary.latest_runs.some((taskRun) => taskRun.status === "failed")) {
    return "failing"
  }
  if (summary.latest_runs.some((taskRun) => taskRun.status === "started")) {
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

function buildSourceHealthRows(
  sourceConfigs: SourceConfig[],
  latestRunByPlugin: Map<string, IngestionRun>,
) {
  return sourceConfigs.map((sourceConfig) => {
    const latestRun = latestRunByPlugin.get(sourceConfig.plugin_name) ?? null

    return {
      sourceConfig,
      latestRun,
      status: deriveSourceStatus(
        sourceConfig.is_active,
        latestRun?.status ?? null,
        sourceConfig.last_fetched_at,
      ),
    }
  })
}

/**
 * Render the source-by-source ingestion health view for the selected project.
 *
 * The page resolves the active project from the URL search params, loads source
 * configurations and their most recent ingestion runs, and then maps those records to
 * a compact health table. When the API user has no available project, the page renders
 * a safe empty state instead of attempting project-scoped API calls.
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
    trendTaskRuns,
    trendTaskRunSummary,
  ] = await Promise.all([
    getProjectSourceConfigs(selectedProject.id),
    getProjectIngestionRuns(selectedProject.id),
    getProjectTopicCentroidSummary(selectedProject.id),
    getProjectTopicCentroidSnapshots(selectedProject.id),
    getProjectSourceDiversitySummary(selectedProject.id),
    getProjectSourceDiversitySnapshots(selectedProject.id),
    getProjectTrendTaskRuns(selectedProject.id),
    getProjectTrendTaskRunSummary(selectedProject.id),
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
  const sortedTrendTaskRuns = trendTaskRuns
    .slice()
    .sort(
      (left, right) =>
        new Date(right.started_at).getTime() - new Date(left.started_at).getTime(),
    )
  const visibleTrendTaskRuns = sortedTrendTaskRuns.slice(0, 12)

  const latestRunByPlugin = new Map<string, (typeof ingestionRuns)[number]>()
  for (const ingestionRun of ingestionRuns) {
    if (!latestRunByPlugin.has(ingestionRun.plugin_name)) {
      latestRunByPlugin.set(ingestionRun.plugin_name, ingestionRun)
    }
  }
  const sourceHealthRows = buildSourceHealthRows(
    sourceConfigs,
    latestRunByPlugin,
  )
  const centroidStatusLabel = centroidSummary.latest_snapshot
    ? centroidSummary.latest_snapshot.centroid_active
      ? "active"
      : "inactive"
    : "idle"
  const trendStatus = deriveTrendTaskRunStatus(trendTaskRunSummary)

  return (
    <AppShell
      title="Ingestion health"
      description="A source-by-source view of freshness, last run outcome, and whether the pipeline is idle, healthy, or failing."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      <TopicCentroidPanel
        historyHref={`/admin/health?project=${selectedProject.id}#centroid-snapshot-history`}
        statusLabel={centroidStatusLabel}
        statusTone={healthTone(deriveCentroidStatus(centroidSummary))}
        summary={centroidSummary}
        trendPoints={centroidDriftTrendPoints}
        visibleSnapshots={visibleCentroidSnapshots}
      />

      <TrendTaskRunsPanel
        historyHref={`/admin/health?project=${selectedProject.id}#trend-task-run-history`}
        statusLabel={trendStatus}
        statusTone={healthTone(trendStatus)}
        summary={trendTaskRunSummary}
        visibleRuns={visibleTrendTaskRuns}
      />

      <SourceDiversityPanel
        statusLabel={sourceDiversitySummary.latest_snapshot ? "tracked" : "idle"}
        statusTone={healthTone(deriveSourceDiversityStatus(sourceDiversitySummary))}
        summary={sourceDiversitySummary}
        trendPoints={sourceDiversityTrendPoints}
        visibleSnapshots={visibleSourceDiversitySnapshots}
      />

      <SourceHealthPanel rows={sourceHealthRows} />
    </AppShell>
  )
}
