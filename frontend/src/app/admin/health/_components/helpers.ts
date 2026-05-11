import type {
  HealthStatus,
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
  TrendTaskRunObservabilitySummary,
} from "@/lib/types"

/** Classify a source row into the shared health badge states. */
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

/** Map centroid summary state onto the shared health badge states. */
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

/** Map source-diversity summary state onto the shared health badge states. */
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

/** Map trend task run summaries onto the shared health badge states. */
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

/** Build sparkline points for centroid drift across recent snapshots. */
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

/** Build sparkline points for recent top-plugin share history. */
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
