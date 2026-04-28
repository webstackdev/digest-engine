import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectIngestionRuns,
  getProjects,
  getProjectSourceConfigs,
} from "@/lib/api"
import type { HealthStatus } from "@/lib/types"
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

  const [sourceConfigs, ingestionRuns] = await Promise.all([
    getProjectSourceConfigs(selectedProject.id),
    getProjectIngestionRuns(selectedProject.id),
  ])

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
