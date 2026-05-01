import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import { getProjectOriginalContentIdeas, getProjects } from "@/lib/api"
import { formatDate, formatPercentScore, getErrorMessage, getSuccessMessage, selectProject } from "@/lib/view-helpers"

type IdeasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const IDEA_DISMISSAL_REASONS = [
  "already assigned",
  "needs stronger evidence",
  "off-topic",
]

function buildIdeasPageHref(projectId: number, statusFilter: string) {
  const params = new URLSearchParams({ project: String(projectId) })
  if (statusFilter && statusFilter !== "all") {
    params.set("status", statusFilter)
  }
  return `/ideas?${params.toString()}`
}

/**
 * Render the original-content ideas queue for the selected project.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `project` and `status` selectors.
 * @returns The rendered ideas page or the no-project empty state.
 */
export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Ideas"
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

  const ideas = await getProjectOriginalContentIdeas(selectedProject.id)
  const statusFilter = String(resolvedSearchParams.status || "all")
  const filteredIdeas =
    !statusFilter || statusFilter === "all"
      ? ideas
      : ideas.filter((idea) => idea.status === statusFilter)
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const pendingCount = ideas.filter((idea) => idea.status === "pending").length
  const acceptedCount = ideas.filter((idea) => idea.status === "accepted").length
  const writtenCount = ideas.filter((idea) => idea.status === "written").length
  const dismissedCount = ideas.filter((idea) => idea.status === "dismissed").length
  const currentPageHref = buildIdeasPageHref(selectedProject.id, statusFilter)

  return (
    <AppShell
      title="Original content ideas"
      description="Review project-owned article angles, trigger fresh ideation, and move accepted ideas through the editorial workflow."
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
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending</p>
          <p className="mt-1 text-3xl font-bold">{pendingCount}</p>
          <p className="text-sm leading-6 text-muted">Ideas waiting for an editor decision.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Accepted</p>
          <p className="mt-1 text-3xl font-bold">{acceptedCount}</p>
          <p className="text-sm leading-6 text-muted">Ideas the editor has queued for writing.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Written</p>
          <p className="mt-1 text-3xl font-bold">{writtenCount}</p>
          <p className="text-sm leading-6 text-muted">Accepted ideas already marked complete.</p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Dismissed</p>
          <p className="mt-1 text-3xl font-bold">{dismissedCount}</p>
          <p className="text-sm leading-6 text-muted">Ideas that were reviewed and intentionally rejected.</p>
        </article>
      </section>

      <section className="mb-4 flex flex-col gap-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl xl:flex-row xl:items-end xl:justify-between">
        <form className="grid gap-2" method="GET">
          <input type="hidden" name="project" value={selectedProject.id} />
          <label className="text-sm font-medium text-ink" htmlFor="status">Status</label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="min-h-11 rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              defaultValue={statusFilter}
              id="status"
              name="status"
            >
              <option value="all">All ideas</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="written">Written</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
              Apply filter
            </button>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50"
              href={`/ideas?project=${selectedProject.id}`}
            >
              Reset
            </Link>
          </div>
        </form>

        <form action={`/api/projects/${selectedProject.id}/ideas/generate`} method="POST">
          <input type="hidden" name="redirectTo" value={currentPageHref} />
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
            Generate now
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {filteredIdeas.length === 0 ? (
          <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
            No original-content ideas matched the current filter.
          </div>
        ) : null}

        {filteredIdeas.map((idea) => (
          <article key={idea.id} className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Original content idea</p>
                <h2 className="font-display text-title-md font-bold text-ink">{idea.angle_title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{idea.summary}</p>
              </div>
              <StatusBadge
                tone={
                  idea.status === "pending"
                    ? "warning"
                    : idea.status === "dismissed"
                      ? "negative"
                      : "positive"
                }
              >
                {idea.status}
              </StatusBadge>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.95fr)]">
              <div className="space-y-4">
                <div>
                  <p className="m-0 text-sm font-medium text-ink">Suggested outline</p>
                  <div className="mt-2 space-y-2 text-sm leading-6 text-muted">
                    {idea.suggested_outline.split("\n").map((line) => (
                      <p className="m-0" key={line}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="m-0 text-sm font-medium text-ink">Why now</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{idea.why_now}</p>
                </div>
                <div>
                  <p className="m-0 text-sm font-medium text-ink">Supporting content</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {idea.supporting_contents.map((content) => (
                      <Link
                        className="inline-flex items-center rounded-full border border-ink/12 bg-surface-strong/55 px-3 py-1 text-sm text-ink transition hover:bg-surface-strong/80"
                        href={`/content/${content.id}?project=${selectedProject.id}`}
                        key={content.id}
                      >
                        {content.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="space-y-4 rounded-panel bg-ink/6 px-4 py-4">
                <div>
                  <p className="m-0 text-sm font-medium text-ink">Workflow metadata</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                    <span>Created {formatDate(idea.created_at)}</span>
                    <span>Score {formatPercentScore(idea.self_critique_score)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">Model: {idea.generated_by_model}</p>
                  {idea.related_cluster ? (
                    <Link
                      className="mt-2 inline-flex items-center rounded-full border border-ink/12 bg-surface-strong/55 px-3 py-1 text-sm text-ink transition hover:bg-surface-strong/80"
                      href={`/trends?project=${selectedProject.id}&cluster=${idea.related_cluster.id}`}
                    >
                      {idea.related_cluster.label || `Cluster ${idea.related_cluster.id}`}
                    </Link>
                  ) : null}
                </div>

                {idea.decided_by_username ? (
                  <p className="text-sm leading-6 text-muted">
                    Decided by {idea.decided_by_username} on {formatDate(idea.decided_at)}
                  </p>
                ) : null}
                {idea.dismissal_reason ? (
                  <p className="text-sm leading-6 text-muted">
                    Dismissal reason: {idea.dismissal_reason}
                  </p>
                ) : null}

                {idea.status === "pending" ? (
                  <div className="flex flex-wrap items-start gap-3">
                    <form
                      action={`/api/projects/${selectedProject.id}/ideas/${idea.id}/accept`}
                      method="POST"
                    >
                      <input type="hidden" name="redirectTo" value={currentPageHref} />
                      <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                        Accept
                      </button>
                    </form>
                    <form
                      action={`/api/projects/${selectedProject.id}/ideas/${idea.id}/dismiss`}
                      className="flex flex-wrap items-center gap-3"
                      method="POST"
                    >
                      <input type="hidden" name="redirectTo" value={currentPageHref} />
                      <select
                        className="min-h-11 rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                        defaultValue={IDEA_DISMISSAL_REASONS[0]}
                        name="reason"
                      >
                        {IDEA_DISMISSAL_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                      <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                        Dismiss
                      </button>
                    </form>
                  </div>
                ) : null}

                {idea.status === "accepted" ? (
                  <form
                    action={`/api/projects/${selectedProject.id}/ideas/${idea.id}/mark-written`}
                    method="POST"
                  >
                    <input type="hidden" name="redirectTo" value={currentPageHref} />
                    <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                      Mark written
                    </button>
                  </form>
                ) : null}
              </aside>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  )
}