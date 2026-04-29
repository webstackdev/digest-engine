import { AppShell } from "@/components/app-shell"
import { CopyButton } from "@/components/copy-button"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectIngestionRuns,
  getProjects,
  getProjectSourceConfigs,
} from "@/lib/api"
import type { Project } from "@/lib/types"
import {
  formatDate,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type BlueskyVerificationState = {
  label: string
  tone: "positive" | "warning" | "negative" | "neutral"
}

/**
 * Build the documented newsletter intake address pattern for one project token.
 *
 * The backend stores only the per-project token today, not the mail-provider domain.
 * This helper renders the documented address pattern so editors can copy the project
 * token and see how it is expected to be used with the inbound mailbox domain.
 *
 * @param intakeToken - The stable per-project intake token.
 * @returns The documented intake address pattern.
 */
export function buildIntakeAddressTemplate(intakeToken: string) {
  return `intake+${intakeToken || "<project-token>"}@inbox.example.com`
}

/**
 * Derive the current Bluesky verification badge state for the selected project.
 *
 * @param project - Project record returned from the backend.
 * @returns A badge label and semantic tone describing the stored credential state.
 */
export function deriveBlueskyVerificationState(
  project: Project,
): BlueskyVerificationState {
  if (!project.has_bluesky_credentials) {
    return { label: "not configured", tone: "neutral" }
  }

  if (project.bluesky_last_error) {
    return { label: "verification failed", tone: "negative" }
  }

  if (project.bluesky_last_verified_at) {
    return { label: "verified", tone: "positive" }
  }

  return { label: "needs verification", tone: "warning" }
}

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
  const blueskyVerificationState = deriveBlueskyVerificationState(selectedProject)
  const intakeAddressTemplate = buildIntakeAddressTemplate(
    selectedProject.intake_token ?? "",
  )
  const sortedSourceConfigs = sourceConfigs
    .slice()
    .sort((left, right) => left.plugin_name.localeCompare(right.plugin_name))

  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <AppShell
      title="Source configuration"
      description="Add, tune, and disable RSS, Reddit, and Bluesky ingestion while keeping newsletter intake controls in the same editor dashboard."
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
        <div className="space-y-4">
          <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Newsletter intake</p>
                <h2 className="m-0 font-display text-title-sm font-bold text-ink">
                  Project intake settings
                </h2>
                <p className="m-0 text-sm leading-6 text-muted">
                  Enable inbound newsletter capture for this project and share the
                  project token with the team managing your inbound mailbox.
                </p>
              </div>
              <StatusBadge tone={selectedProject.intake_enabled ? "positive" : "neutral"}>
                {selectedProject.intake_enabled ? "enabled" : "disabled"}
              </StatusBadge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-sm font-medium text-ink">Intake token</span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 font-mono text-sm text-ink outline-none"
                    readOnly
                    value={selectedProject.intake_token ?? ""}
                  />
                  <CopyButton label="Copy token" value={selectedProject.intake_token ?? ""} />
                </div>
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium text-ink">Address pattern</span>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 font-mono text-sm text-ink outline-none"
                    readOnly
                    value={intakeAddressTemplate}
                  />
                  <CopyButton label="Copy pattern" value={intakeAddressTemplate} />
                </div>
                <p className="m-0 text-xs leading-5 text-muted">
                  Replace <span className="font-mono text-ink">inbox.example.com</span> with
                  the inbound mailbox domain configured for your email provider.
                </p>
              </div>
            </div>

            <form
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
              action={`/api/projects/${selectedProject.id}/intake`}
              method="POST"
            >
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/sources?project=${selectedProject.id}`}
              />
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Intake status</span>
                <select
                  className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  name="intake_enabled"
                  defaultValue={selectedProject.intake_enabled ? "true" : "false"}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
              <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                Save intake settings
              </button>
            </form>

            <p className="m-0 text-sm leading-6 text-muted">
              Token rotation, allowlist management, and recent newsletter-intake rows are
              still handled outside this page and will need a follow-up API slice.
            </p>
          </article>

          <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Bluesky</p>
                <h2 className="m-0 font-display text-title-sm font-bold text-ink">
                  Credential verification
                </h2>
                <p className="m-0 text-sm leading-6 text-muted">
                  Add Bluesky source configs below, then verify the stored account session
                  without leaving the editor dashboard.
                </p>
              </div>
              <StatusBadge tone={blueskyVerificationState.tone}>
                {blueskyVerificationState.label}
              </StatusBadge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Stored credentials
                </p>
                <p className="m-0 text-sm leading-6 text-ink">
                  {selectedProject.has_bluesky_credentials
                    ? selectedProject.bluesky_handle || "Handle available after save"
                    : "No Bluesky credentials are configured for this project yet."}
                </p>
                <p className="m-0 text-sm leading-6 text-muted">
                  {selectedProject.bluesky_last_verified_at
                    ? `Last verified ${formatDate(selectedProject.bluesky_last_verified_at)}`
                    : "Run verification after saving credentials to confirm the session."}
                </p>
                {selectedProject.bluesky_last_error ? (
                  <p className="m-0 text-sm leading-6 text-danger-ink">
                    {selectedProject.bluesky_last_error}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Config examples
                </p>
                <p className="m-0 text-sm leading-6 text-muted">
                  Use <span className="font-mono text-ink">{"{\"actor\": \"newsroom.bsky.social\"}"}</span> for an author timeline or <span className="font-mono text-ink">{"{\"feed_uri\": \"at://did:plc.../app.bsky.feed.generator/...\"}"}</span> for a custom feed.
                </p>
                <p className="m-0 text-sm leading-6 text-muted">
                  Credential entry still lives in Django admin for now. This panel surfaces
                  the current verification state and lets you rerun the session check.
                </p>
              </div>
            </div>

            <form
              action={`/api/projects/${selectedProject.id}/verify-bluesky-credentials`}
              method="POST"
            >
              <input
                type="hidden"
                name="redirectTo"
                value={`/admin/sources?project=${selectedProject.id}`}
              />
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedProject.has_bluesky_credentials}
                type="submit"
              >
                Verify credentials
              </button>
            </form>
          </article>

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
                  <option value="bluesky">Bluesky</option>
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
              <p className="m-0 text-sm leading-6 text-muted">
                Bluesky configs accept either an actor handle or a feed URI. RSS and Reddit
                continue to use the existing backend JSON shapes.
              </p>
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
        </div>

        <div className="space-y-4">
          {sortedSourceConfigs.length === 0 ? (
            <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
              No source configurations exist for this project yet.
            </div>
          ) : null}
          {sortedSourceConfigs.map((sourceConfig) => {
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
