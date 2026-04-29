import { AppShell } from "@/components/app-shell"
import { CopyButton } from "@/components/copy-button"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectBlueskyCredentials,
  getProjectIngestionRuns,
  getProjectIntakeAllowlist,
  getProjectNewsletterIntakes,
  getProjects,
  getProjectSourceConfigs,
} from "@/lib/api"
import type { BlueskyCredentials, NewsletterIntake, Project } from "@/lib/types"
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
 * Build a concise newsletter-intake preview from persisted extraction data.
 *
 * @param intake - One persisted newsletter intake row.
 * @returns A short human-readable preview for the intake history card.
 */
export function buildNewsletterIntakePreview(intake: NewsletterIntake) {
  const extractedItems = intake.extraction_result?.items ?? []
  if (extractedItems.length > 0) {
    return extractedItems
      .slice(0, 2)
      .map((item) => item.title || item.url)
      .join("; ")
  }

  if (intake.error_message) {
    return intake.error_message
  }

  return intake.raw_text.slice(0, 160) || "No preview available yet."
}

/**
 * Filter newsletter intake rows using URL-driven sender and status criteria.
 *
 * @param newsletterIntakes - Full newsletter intake list for the selected project.
 * @param filters - Filter values read from the sources page search params.
 * @returns The filtered intake rows.
 */
export function filterNewsletterIntakes(
  newsletterIntakes: NewsletterIntake[],
  filters: { status: string; sender: string },
) {
  const normalizedSender = filters.sender.trim().toLowerCase()

  return newsletterIntakes.filter((intake) => {
    if (filters.status && intake.status !== filters.status) {
      return false
    }
    if (
      normalizedSender &&
      !intake.sender_email.toLowerCase().includes(normalizedSender)
    ) {
      return false
    }
    return true
  })
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

  const [
    sourceConfigs,
    ingestionRuns,
    intakeAllowlist,
    newsletterIntakes,
    blueskyCredentials,
  ] = await Promise.all([
    getProjectSourceConfigs(selectedProject.id),
    getProjectIngestionRuns(selectedProject.id),
    getProjectIntakeAllowlist(selectedProject.id),
    getProjectNewsletterIntakes(selectedProject.id),
    getProjectBlueskyCredentials(selectedProject.id),
  ])
  const latestRunByPlugin = buildLatestRunByPlugin(ingestionRuns)
  const blueskyVerificationState = deriveBlueskyVerificationState(selectedProject)
  const intakeAddressTemplate = buildIntakeAddressTemplate(
    selectedProject.intake_token ?? "",
  )
  const sortedSourceConfigs = sourceConfigs
    .slice()
    .sort((left, right) => left.plugin_name.localeCompare(right.plugin_name))
  const intakeStatusFilter = String(resolvedSearchParams.intakeStatus || "")
  const intakeSenderFilter = String(resolvedSearchParams.intakeSender || "")
  const selectedIntakeId = Number.parseInt(
    String(resolvedSearchParams.intakeId || "0"),
    10,
  )
  const filteredNewsletterIntakes = filterNewsletterIntakes(newsletterIntakes, {
    status: intakeStatusFilter,
    sender: intakeSenderFilter,
  })
  const recentNewsletterIntakes = filteredNewsletterIntakes.slice(0, 6)
  const selectedIntake =
    newsletterIntakes.find((intake) => intake.id === selectedIntakeId) ??
    recentNewsletterIntakes[0] ??
    null
  const currentBlueskyCredentials: BlueskyCredentials | null =
    blueskyCredentials[0] ?? null

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
                  <form
                    action={`/api/projects/${selectedProject.id}/rotate-intake-token`}
                    method="POST"
                  >
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/admin/sources?project=${selectedProject.id}`}
                    />
                    <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50" type="submit">
                      Rotate token
                    </button>
                  </form>
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                <div className="space-y-1">
                  <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                    Sender allowlist
                  </p>
                  <p className="m-0 text-sm leading-6 text-muted">
                    Confirmed senders process automatically after the first email. Pending
                    senders still need to visit their confirmation link.
                  </p>
                </div>

                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                  action={`/api/projects/${selectedProject.id}/intake-allowlist`}
                  method="POST"
                >
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/admin/sources?project=${selectedProject.id}`}
                  />
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Sender email</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="senderEmail"
                      placeholder="newsletter@example.com"
                      required
                      type="email"
                    />
                  </label>
                  <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                    Add sender
                  </button>
                </form>

                {intakeAllowlist.length === 0 ? (
                  <p className="m-0 rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
                    No senders have been allowlisted for this project yet.
                  </p>
                ) : (
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {intakeAllowlist.map((entry) => (
                      <li key={entry.id} className="rounded-2xl border border-ink/10 bg-surface/80 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <p className="m-0 text-sm font-medium text-ink">{entry.sender_email}</p>
                            <p className="m-0 text-sm leading-6 text-muted">
                              {entry.is_confirmed
                                ? `Confirmed ${formatDate(entry.confirmed_at)}`
                                : "Awaiting confirmation via emailed link."}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={entry.is_confirmed ? "positive" : "warning"}>
                              {entry.is_confirmed ? "confirmed" : "pending"}
                            </StatusBadge>
                            <form
                              action={`/api/projects/${selectedProject.id}/intake-allowlist/${entry.id}`}
                              method="POST"
                            >
                              <input
                                type="hidden"
                                name="redirectTo"
                                value={`/admin/sources?project=${selectedProject.id}`}
                              />
                              <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-danger/25 bg-danger/12 px-4 py-3 text-sm font-medium text-danger-ink transition hover:bg-danger/16" type="submit">
                                Remove
                              </button>
                            </form>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-4 rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                <div className="space-y-1">
                  <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                    Recent newsletter intake
                  </p>
                  <p className="m-0 text-sm leading-6 text-muted">
                    Latest inbound emails captured for this project, including extraction
                    status and the first preview items the system stored.
                  </p>
                </div>

                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                  method="GET"
                >
                  <input type="hidden" name="project" value={selectedProject.id} />
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Status</span>
                    <select
                      className="w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={intakeStatusFilter}
                      name="intakeStatus"
                    >
                      <option value="">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="extracted">Extracted</option>
                      <option value="failed">Failed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Sender contains</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={intakeSenderFilter}
                      name="intakeSender"
                      placeholder="newsletter@example.com"
                    />
                  </label>
                  <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50" type="submit">
                    Filter
                  </button>
                </form>

                {recentNewsletterIntakes.length === 0 ? (
                  <p className="m-0 rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
                    No inbound newsletters have been captured for this project yet.
                  </p>
                ) : (
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {recentNewsletterIntakes.map((intake) => (
                      <li key={intake.id} className="rounded-2xl border border-ink/10 bg-surface/80 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <p className="m-0 text-sm font-medium text-ink">{intake.subject}</p>
                            <div className="flex flex-wrap gap-2 text-sm text-muted">
                              <span>{intake.sender_email}</span>
                              <span>{formatDate(intake.received_at)}</span>
                              <span>{intake.message_id}</span>
                            </div>
                            <p className="m-0 text-sm leading-6 text-muted">
                              {buildNewsletterIntakePreview(intake)}
                            </p>
                          </div>
                          <StatusBadge
                            tone={
                              intake.status === "extracted"
                                ? "positive"
                                : intake.status === "failed"
                                  ? "negative"
                                  : "warning"
                            }
                          >
                            {intake.status}
                          </StatusBadge>
                          <a
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50"
                            href={`/admin/sources?project=${selectedProject.id}&intakeId=${intake.id}${intakeStatusFilter ? `&intakeStatus=${encodeURIComponent(intakeStatusFilter)}` : ""}${intakeSenderFilter ? `&intakeSender=${encodeURIComponent(intakeSenderFilter)}` : ""}`}
                          >
                            Open details
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedIntake ? (
                  <article className="space-y-3 rounded-2xl border border-ink/10 bg-surface/80 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="m-0 text-sm font-semibold text-ink">Selected intake</p>
                        <p className="m-0 text-sm leading-6 text-muted">{selectedIntake.subject}</p>
                      </div>
                      <StatusBadge
                        tone={
                          selectedIntake.status === "extracted"
                            ? "positive"
                            : selectedIntake.status === "failed"
                              ? "negative"
                              : "warning"
                        }
                      >
                        {selectedIntake.status}
                      </StatusBadge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted">
                      <span>{selectedIntake.sender_email}</span>
                      <span>{selectedIntake.message_id}</span>
                      <span>{formatDate(selectedIntake.received_at)}</span>
                    </div>
                    {selectedIntake.extraction_result?.items?.length ? (
                      <ul className="m-0 grid list-none gap-2 p-0">
                        {selectedIntake.extraction_result.items.slice(0, 4).map((item) => (
                          <li key={`${selectedIntake.id}:${item.position}`} className="rounded-2xl border border-ink/10 bg-surface-strong/45 p-3 text-sm text-muted">
                            <span className="font-medium text-ink">{item.title || item.url}</span>
                            <div className="mt-1 break-words">{item.url}</div>
                            {item.excerpt ? <div className="mt-1">{item.excerpt}</div> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-sm leading-6 text-muted">{buildNewsletterIntakePreview(selectedIntake)}</p>
                    )}
                    {selectedIntake.raw_text ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-ink">Raw text preview</summary>
                        <pre className="mt-3 overflow-auto rounded-2xl bg-sidebar/95 p-4 text-sm text-sidebar-ink whitespace-pre-wrap">{selectedIntake.raw_text.slice(0, 2000)}</pre>
                      </details>
                    ) : null}
                  </article>
                ) : null}
              </section>
            </div>
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
                  {currentBlueskyCredentials
                    ? currentBlueskyCredentials.handle || "Handle available after save"
                    : "No Bluesky credentials are configured for this project yet."}
                </p>
                <p className="m-0 text-sm leading-6 text-muted">
                  {currentBlueskyCredentials?.last_verified_at
                    ? `Last verified ${formatDate(currentBlueskyCredentials.last_verified_at)}`
                    : "Run verification after saving credentials to confirm the session."}
                </p>
                {currentBlueskyCredentials?.last_error ? (
                  <p className="m-0 text-sm leading-6 text-danger-ink">
                    {currentBlueskyCredentials.last_error}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 rounded-2xl border border-ink/10 bg-surface-strong/45 p-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Save credentials
                </p>
                <form
                  className="space-y-4"
                  action={`/api/projects/${selectedProject.id}/bluesky-credentials`}
                  method="POST"
                >
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/admin/sources?project=${selectedProject.id}`}
                  />
                  <input
                    type="hidden"
                    name="credentialId"
                    value={currentBlueskyCredentials?.id ?? ""}
                  />
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Handle</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={currentBlueskyCredentials?.handle ?? ""}
                      name="handle"
                      placeholder="project.bsky.social"
                      required
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">PDS URL</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={currentBlueskyCredentials?.pds_url ?? ""}
                      name="pds_url"
                      placeholder="https://pds.example.com"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">App password</span>
                    <input
                      className="w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      name="app_password"
                      placeholder={
                        currentBlueskyCredentials?.has_stored_credential
                          ? "Leave blank to keep the current stored credential"
                          : "Required on first save"
                      }
                      type="password"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-ink">Status</span>
                    <select
                      className="w-full rounded-2xl border border-ink/12 bg-surface px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      defaultValue={currentBlueskyCredentials?.is_active === false ? "false" : "true"}
                      name="is_active"
                    >
                      <option value="true">Active</option>
                      <option value="false">Disabled</option>
                    </select>
                  </label>
                  <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50" type="submit">
                    {currentBlueskyCredentials ? "Update credentials" : "Save credentials"}
                  </button>
                </form>
                <p className="m-0 text-sm leading-6 text-muted">
                  Use <span className="font-mono text-ink">{"{\"actor\": \"newsroom.bsky.social\"}"}</span> for an author timeline or <span className="font-mono text-ink">{"{\"feed_uri\": \"at://did:plc.../app.bsky.feed.generator/...\"}"}</span> for a custom feed.
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
