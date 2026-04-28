import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { StatusBadge } from "@/components/status-badge"
import {
  getProjectContents,
  getProjectEntities,
  getProjectFeedback,
  getProjectReviewQueue,
  getProjects,
  getProjectSourceConfigs,
} from "@/lib/api"
import { buildDashboardView } from "@/lib/dashboard-view"
import {
  formatDate,
  formatScore,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
  truncateText,
} from "@/lib/view-helpers"

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the project dashboard for the selected API-visible project.
 *
 * The page resolves the active project from the URL, loads the project-scoped content,
 * review queue, entity, source, and feedback data, and then delegates filter and summary
 * derivation to `buildDashboardView`. When the current API user has no visible projects,
 * the page returns a guarded empty state instead of issuing any project-scoped requests.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional dashboard filters and flash messages.
 * @returns The rendered project dashboard or the no-project empty state.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Dashboard"
        description="Create a project in Django admin first, then come back here to review ingested content."
        projects={[]}
        selectedProjectId={null}
      >
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
          No projects are available for the configured API user.
        </div>
      </AppShell>
    )
  }

  const [contents, reviewQueue, entities, sourceConfigs, feedback] =
    await Promise.all([
      getProjectContents(selectedProject.id),
      getProjectReviewQueue(selectedProject.id),
      getProjectEntities(selectedProject.id),
      getProjectSourceConfigs(selectedProject.id),
      getProjectFeedback(selectedProject.id),
    ])

  const {
    contentMap,
    contentTypeFilter,
    contentTypes,
    daysFilter,
    filteredContents,
    negativeFeedback,
    pendingReviewItems,
    positiveFeedback,
    sourceFilter,
    sources,
    view,
  } = buildDashboardView({
    contents,
    reviewQueue,
    feedback,
    searchParams: resolvedSearchParams,
  })
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <AppShell
      title={`${selectedProject.name} dashboard`}
      description="Ranked content, pending human review, and quick editorial actions backed by the current Django API."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Surfaced</p>
          <p className="mt-1 text-3xl font-bold">{filteredContents.length}</p>
          <p className="text-sm leading-6 text-muted">
            Active content items in the current filter window.
          </p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Review queue</p>
          <p className="mt-1 text-3xl font-bold">{pendingReviewItems.length}</p>
          <p className="text-sm leading-6 text-muted">
            Borderline or low-confidence items waiting on an editor.
          </p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Tracked entities</p>
          <p className="mt-1 text-3xl font-bold">{entities.length}</p>
          <p className="text-sm leading-6 text-muted">
            People, vendors, and organizations linked to this project.
          </p>
        </article>
        <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Signals</p>
          <p className="mt-1 text-3xl font-bold">
            {positiveFeedback}/{negativeFeedback}
          </p>
          <p className="text-sm leading-6 text-muted">
            Upvotes and downvotes captured through the API so far.
          </p>
        </article>
      </section>

      {errorMessage ? (
        <div className="rounded-panel bg-danger/14 px-4 py-4 text-sm leading-6 text-danger-ink">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <form
        className="mb-4 grid gap-4 rounded-3xl border border-ink/12 bg-surface/85 p-[1.1rem] shadow-panel backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] xl:items-end"
        method="GET"
      >
        <input type="hidden" name="project" value={selectedProject.id} />
        <div className="grid gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="view">
            View
          </label>
          <select
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="view"
            name="view"
            defaultValue={view}
          >
            <option value="content">Surfaced content</option>
            <option value="review">Pending review</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="contentType">
            Content type
          </label>
          <select
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="contentType"
            name="contentType"
            defaultValue={contentTypeFilter}
          >
            <option value="">All types</option>
            {contentTypes.map((contentType) => (
              <option key={contentType} value={contentType}>
                {contentType}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="source">
            Source
          </label>
          <select
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="source"
            name="source"
            defaultValue={sourceFilter}
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-ink" htmlFor="days">
            Published within
          </label>
          <select
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="days"
            name="days"
            defaultValue={String(daysFilter)}
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
            Apply filters
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50"
            href={`/?project=${selectedProject.id}`}
          >
            Reset
          </Link>
        </div>
      </form>

      {view === "review" ? (
        <section className="overflow-hidden rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/12 text-sm text-muted">
                  <th className="px-3 py-4 font-medium">Content</th>
                  <th className="px-3 py-4 font-medium">Reason</th>
                  <th className="px-3 py-4 font-medium">Confidence</th>
                  <th className="px-3 py-4 font-medium">Queued</th>
                  <th className="px-3 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingReviewItems.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4" colSpan={5}>
                      <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
                        No unresolved review items for this project right now.
                      </div>
                    </td>
                  </tr>
                ) : null}
                {pendingReviewItems.map((item) => {
                  const content = contentMap.get(item.content)
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-ink/12 align-top last:border-b-0"
                    >
                      <td className="px-3 py-4">
                        <strong className="font-medium text-ink">
                          {content?.title ?? `Content #${item.content}`}
                        </strong>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                          <span>
                            {content?.source_plugin ?? "unknown source"}
                          </span>
                          <span>{content?.content_type || "unclassified"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-ink">
                        {item.reason}
                      </td>
                      <td className="px-3 py-4 text-sm text-ink">
                        {formatScore(item.confidence)}
                      </td>
                      <td className="px-3 py-4 text-sm text-ink">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <form action={`/api/review/${item.id}`} method="POST">
                            <input
                              type="hidden"
                              name="projectId"
                              value={selectedProject.id}
                            />
                            <input type="hidden" name="resolved" value="true" />
                            <input
                              type="hidden"
                              name="resolution"
                              value="human_approved"
                            />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value={`/?project=${selectedProject.id}&view=review`}
                            />
                            <button
                              className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                              type="submit"
                            >
                              Approve
                            </button>
                          </form>
                          <form action={`/api/review/${item.id}`} method="POST">
                            <input
                              type="hidden"
                              name="projectId"
                              value={selectedProject.id}
                            />
                            <input type="hidden" name="resolved" value="true" />
                            <input
                              type="hidden"
                              name="resolution"
                              value="human_rejected"
                            />
                            <input
                              type="hidden"
                              name="redirectTo"
                              value={`/?project=${selectedProject.id}&view=review`}
                            />
                            <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                              Reject
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
          <div className="space-y-4">
            {filteredContents.length === 0 ? (
              <div className="rounded-panel bg-ink/6 px-4 py-4 text-sm leading-6 text-muted">
                No content matched the current filters.
              </div>
            ) : null}
            {filteredContents.map((content) => (
              <article key={content.id} className="grid gap-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <h3 className="font-display text-title-md font-bold">
                      {content.title}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-sm text-muted">
                      <span>{formatDate(content.published_date)}</span>
                      <span>{content.author || "Unknown author"}</span>
                      <span>{content.source_plugin}</span>
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      (content.relevance_score ?? 0) >= 0.7
                        ? "positive"
                        : "warning"
                    }
                  >
                    Relevance {formatScore(content.relevance_score)}
                  </StatusBadge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-ink/12 bg-surface-strong/55 px-3 py-1 text-sm text-ink">
                    {content.content_type || "unclassified"}
                  </span>
                  {content.is_reference ? (
                    <span className="inline-flex items-center rounded-full border border-ink/12 bg-surface-strong/55 px-3 py-1 text-sm text-ink">reference</span>
                  ) : null}
                  {!content.is_active ? (
                    <span className="inline-flex items-center rounded-full border border-ink/12 bg-surface-strong/55 px-3 py-1 text-sm text-ink">archived</span>
                  ) : null}
                </div>

                <p className="text-sm leading-6 text-muted">
                  {truncateText(content.content_text)}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    href={`/content/${content.id}?project=${selectedProject.id}`}
                  >
                    Open detail
                  </Link>
                  <form action="/api/feedback" method="POST">
                    <input
                      type="hidden"
                      name="projectId"
                      value={selectedProject.id}
                    />
                    <input type="hidden" name="contentId" value={content.id} />
                    <input type="hidden" name="feedbackType" value="upvote" />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/?project=${selectedProject.id}`}
                    />
                    <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                      Upvote
                    </button>
                  </form>
                  <form action="/api/feedback" method="POST">
                    <input
                      type="hidden"
                      name="projectId"
                      value={selectedProject.id}
                    />
                    <input type="hidden" name="contentId" value={content.id} />
                    <input type="hidden" name="feedbackType" value="downvote" />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/?project=${selectedProject.id}`}
                    />
                    <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/12 bg-transparent px-4 py-3 text-sm font-medium text-ink transition hover:bg-surface-strong/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                      Downvote
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>

          <aside className="space-y-4">
            <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Project focus</p>
              <h3 className="font-display text-title-md">
                {selectedProject.name}
              </h3>
              <p className="text-sm leading-6 text-muted">
                {selectedProject.topic_description}
              </p>
            </article>

            <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Active sources</p>
              <p className="mt-1 text-3xl font-bold">
                {sourceConfigs.filter((item) => item.is_active).length}
              </p>
              <p className="text-sm leading-6 text-muted">
                Configured feeds and subreddits delivering new content.
              </p>
            </article>

            <article className="rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Editorial queue</p>
              <p className="mt-1 text-3xl font-bold">
                {pendingReviewItems.length}
              </p>
              <p className="text-sm leading-6 text-muted">
                Use the view switch above to resolve borderline items.
              </p>
            </article>
          </aside>
        </section>
      )}
    </AppShell>
  )
}
