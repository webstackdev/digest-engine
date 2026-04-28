import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectIngestionRuns,
  getProjects,
  getProjectSourceConfigs,
} from "@/lib/api"
import {
  formatDate,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type SourcesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Build a per-plugin lookup of the newest ingestion run records already returned by the API.
 *
 * The ingestion runs list is expected to arrive in newest-first order. This helper keeps the
 * first run seen for each plugin so the page can show one concise status summary beside each
 * source configuration without re-sorting or scanning the array repeatedly.
 *
 * @param ingestionRuns - Ingestion history for the selected project, ideally ordered newest first.
 * @returns A map keyed by plugin name with the latest run for each source plugin.
 */
export function buildLatestRunByPlugin(
  ingestionRuns: Awaited<ReturnType<typeof getProjectIngestionRuns>>,
) {
  const latestRunByPlugin = new Map<string, (typeof ingestionRuns)[number]>()
  for (const ingestionRun of ingestionRuns) {
    if (!latestRunByPlugin.has(ingestionRun.plugin_name)) {
      latestRunByPlugin.set(ingestionRun.plugin_name, ingestionRun)
    }
  }
  return latestRunByPlugin
}

/**
 * Render the source-configuration admin page for the selected project.
 *
 * The page resolves the active project from the URL, shows any success or error flash messages
 * returned from the source-config routes, and renders both the create form and the editable list
 * of existing source configurations. When no project is available, it renders a guarded empty
 * state instead of issuing project-scoped API requests.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `project`, `message`, and `error` values.
 * @returns The rendered source configuration admin page or the no-project empty state.
 */
export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Sources"
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
  const latestRunByPlugin = buildLatestRunByPlugin(ingestionRuns)

  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <AppShell
      title="Source configuration"
      description="Add, tune, and disable RSS feeds or Reddit subscriptions without leaving the editor dashboard."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
        <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Add source</p>
          <form
            className="space-y-4"
            action="/api/source-configs"
            method="POST"
          >
            <input type="hidden" name="projectId" value={selectedProject.id} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/sources?project=${selectedProject.id}`}
            />
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink">Plugin</span>
              <select
                className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                name="plugin_name"
                defaultValue="rss"
              >
                <option value="rss">RSS</option>
                <option value="reddit">Reddit</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink">Config JSON</span>
              <textarea
                className="min-h-30 w-full resize-y rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 font-mono text-sm text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                name="config_json"
                defaultValue={JSON.stringify(
                  { feed_url: "https://example.com/feed.xml" },
                  null,
                  2,
                )}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink">Active</span>
              <select
                className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                name="is_active"
                defaultValue="true"
              >
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
              Create source
            </button>
          </form>
        </article>

        <div className="space-y-4">
          {sourceConfigs.length === 0 ? (
            <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
              No source configurations exist for this project yet.
            </div>
          ) : null}
          {sourceConfigs.map((sourceConfig) => {
            const latestRun =
              latestRunByPlugin.get(sourceConfig.plugin_name) ?? null
            return (
              <article
                key={sourceConfig.id}
                className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-display text-title-md font-bold">
                      {sourceConfig.plugin_name}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-sm text-muted">
                      <span>Config #{sourceConfig.id}</span>
                      <span>
                        Last fetch {formatDate(sourceConfig.last_fetched_at)}
                      </span>
                    </div>
                  </div>
                  <StatusBadge
                    tone={sourceConfig.is_active ? "positive" : "neutral"}
                  >
                    {sourceConfig.is_active ? "active" : "disabled"}
                  </StatusBadge>
                </div>

                <form
                  className="space-y-4"
                  action={`/api/source-configs/${sourceConfig.id}`}
                  method="POST"
                >
                  <input
                    type="hidden"
                    name="projectId"
                    value={selectedProject.id}
                  />
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/admin/sources?project=${selectedProject.id}`}
                  />
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Plugin</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="plugin_name"
                      defaultValue={sourceConfig.plugin_name}
                      readOnly
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Config JSON</span>
                    <textarea
                      className="min-h-30 w-full resize-y rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 font-mono text-sm text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="config_json"
                      defaultValue={JSON.stringify(
                        sourceConfig.config,
                        null,
                        2,
                      )}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Active</span>
                    <select
                      className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="is_active"
                      defaultValue={sourceConfig.is_active ? "true" : "false"}
                    >
                      <option value="true">Active</option>
                      <option value="false">Disabled</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>
                      Latest run: {latestRun ? latestRun.status : "none"}
                    </span>
                    <span>{latestRun?.error_message || "No recent error"}</span>
                  </div>
                  <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                    Save source
                  </button>
                </form>
              </article>
            )
          })}
        </div>
      </section>
    </AppShell>
  )
}
