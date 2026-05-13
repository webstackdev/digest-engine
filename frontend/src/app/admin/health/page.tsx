import {
  buildCentroidDriftTrendPoints,
  buildSourceDiversityTrendPoints,
  deriveCentroidStatus,
  deriveSourceDiversityStatus,
  deriveSourceStatus,
  deriveTrendTaskRunStatus,
} from "@/app/admin/health/_components/helpers"
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
import type { IngestionRun, SourceConfig } from "@/lib/types"
import { healthTone, selectProject } from "@/lib/view-helpers"

type HealthPageProps = {
  /** Search params promise containing the optional `project` selector. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
        <div className="rounded-panel bg-muted px-4 py-4 text-sm leading-6 text-muted">
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
