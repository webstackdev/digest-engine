import Link from "next/link"

import { SkillActionBar } from "@/app/content/[id]/_components/SkillActionBar"
import { AppShell } from "@/components/layout/AppShell"
import { StatusBadge } from "@/components/ui/StatusBadge"
import {
  getProjectContent,
  getProjectFeedback,
  getProjectReviewQueue,
  getProjects,
  getProjectSkillResults,
} from "@/lib/api"
import {
  formatDate,
  formatPercentScore,
  formatScore,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type ContentDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Derive the pending skill actions that should hydrate the client action bar.
 *
 * Only the latest non-superseded relevance and summarization results should control the
 * pending state shown to the editor. Completed, failed, and superseded records are ignored
 * so the page reflects only active background work for the current content item.
 *
 * @param skillResults - Skill results already filtered to the current content item.
 * @returns The pending or running skill names relevant to the action bar.
 */
export function deriveInitialPendingSkills(
  skillResults: Awaited<ReturnType<typeof getProjectSkillResults>>,
) {
  return skillResults
    .filter(
      (item) =>
        item.superseded_by === null &&
        (item.skill_name === "relevance_scoring" ||
          item.skill_name === "summarization") &&
        (item.status === "pending" || item.status === "running"),
    )
    .map((item) => item.skill_name as "relevance_scoring" | "summarization")
}

/**
 * Render the detail view for a single content item within the selected project.
 *
 * This page joins the content record with persisted skill results, review queue entries,
 * and user feedback so editors can inspect raw article text and workflow state in one place.
 * When no project is available for the configured API user, the page returns a guarded empty
 * state instead of issuing project-scoped API calls.
 *
 * @param props - Async server component props from the App Router.
 * @param props.params - Route params promise containing the content id.
 * @param props.searchParams - Search params promise containing the optional `project`, `error`, and `message` values.
 * @returns The rendered content detail page or the no-project empty state.
 */
export default async function ContentDetailPage({
  params,
  searchParams,
}: ContentDetailPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ])
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Content detail"
        description="No project is available for the configured API user."
        projects={[]}
        selectedProjectId={null}
      >
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const contentId = Number.parseInt(id, 10)
  const [content, skillResults, reviewQueue, feedback] = await Promise.all([
    getProjectContent(selectedProject.id, contentId),
    getProjectSkillResults(selectedProject.id),
    getProjectReviewQueue(selectedProject.id),
    getProjectFeedback(selectedProject.id),
  ])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const contentSkillResults = skillResults.filter(
    (item) => item.content === content.id,
  )
  const reviewItems = reviewQueue.filter((item) => item.content === content.id)
  const contentFeedback = feedback.filter((item) => item.content === content.id)
  const upvotes = contentFeedback.filter(
    (item) => item.feedback_type === "upvote",
  ).length
  const downvotes = contentFeedback.filter(
    (item) => item.feedback_type === "downvote",
  ).length
  const effectiveRelevanceScore =
    content.authority_adjusted_score ?? content.relevance_score
  const canSummarize = (effectiveRelevanceScore ?? 0) >= 0.7
  const initialPendingSkills = deriveInitialPendingSkills(contentSkillResults)

  return (
    <AppShell
      title="Content detail"
      description="Inspect the raw article, persisted skill outputs, and editorial status for a single content item."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
        <div className="space-y-4">
          <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">{content.source_plugin}</p>
                <h3 className="font-display text-title-md font-bold">
                  {content.title}
                </h3>
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  <span>{formatDate(content.published_date)}</span>
                  <span>{content.author || "Unknown author"}</span>
                  <span>{content.content_type || "unclassified"}</span>
                </div>
              </div>
              <StatusBadge
                tone={
                  (effectiveRelevanceScore ?? 0) >= 0.7 ? "positive" : "warning"
                }
              >
                Adjusted {formatPercentScore(effectiveRelevanceScore)}
              </StatusBadge>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                href={content.url}
                target="_blank"
              >
                Open source
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
                  value={`/content/${content.id}?project=${selectedProject.id}`}
                />
                <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
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
                  value={`/content/${content.id}?project=${selectedProject.id}`}
                />
                <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                  Downvote
                </button>
              </form>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
              <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                Canonical URL {content.canonical_url || content.url}
              </span>
              {content.authority_adjusted_score !== null ? (
                <span className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-foreground">
                  Base {formatPercentScore(content.relevance_score)}
                </span>
              ) : null}
              {content.duplicate_signal_count > 0 ? (
                <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                  Also seen in {content.duplicate_signal_count} source
                  {content.duplicate_signal_count === 1 ? "" : "s"}
                </span>
              ) : null}
              {content.duplicate_of ? (
                <Link
                  className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground transition hover:bg-muted/80"
                  href={`/content/${content.duplicate_of}?project=${selectedProject.id}`}
                >
                  Duplicate of #{content.duplicate_of}
                </Link>
              ) : null}
              {content.newsletter_promotion_at ? (
                <Link
                  className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-foreground transition hover:bg-primary/12"
                  href={content.newsletter_promotion_theme ? `/themes?project=${selectedProject.id}&theme=${content.newsletter_promotion_theme}` : `/themes?project=${selectedProject.id}`}
                >
                  Promoted {formatDate(content.newsletter_promotion_at)}
                </Link>
              ) : null}
            </div>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted md:text-base">
              {content.content_text}
            </div>
          </article>

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Skill action bar</p>
            <div className="flex flex-wrap items-center gap-3">
              <SkillActionBar
                key={`${selectedProject.id}:${content.id}:${initialPendingSkills.slice().sort().join(",")}`}
                projectId={selectedProject.id}
                contentId={content.id}
                canSummarize={canSummarize}
                initialPendingSkills={initialPendingSkills}
              />
              <form action="/api/skills/find_related" method="POST">
                <input
                  type="hidden"
                  name="projectId"
                  value={selectedProject.id}
                />
                <input type="hidden" name="contentId" value={content.id} />
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/content/${content.id}?project=${selectedProject.id}`}
                />
                <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                  Find related
                </button>
              </form>
            </div>
            <p className="text-sm leading-6 text-muted">
              These controls create new persisted SkillResult records.
              Summarization is only available once a content item has reached a
              final adjusted relevance score of at least 70%.
            </p>
          </article>

          {contentSkillResults.map((skillResult) => (
            <article key={skillResult.id} className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">{skillResult.skill_name}</p>
                  <h3 className="font-display text-title-md font-bold">
                    {skillResult.status}
                  </h3>
                </div>
                <StatusBadge
                  tone={
                    skillResult.status === "completed"
                      ? "positive"
                      : skillResult.status === "failed"
                        ? "negative"
                        : "warning"
                  }
                >
                  {skillResult.model_used || "model pending"}
                </StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted">
                <span>Created {formatDate(skillResult.created_at)}</span>
                <span>Latency {skillResult.latency_ms ?? 0} ms</span>
                <span>Confidence {formatScore(skillResult.confidence)}</span>
              </div>
              {skillResult.error_message ? (
                <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">
                  {skillResult.error_message}
                </div>
              ) : null}
              <pre className="overflow-auto rounded-2xl bg-sidebar/95 p-4 text-sm text-sidebar-foreground">
                {JSON.stringify(skillResult.result_data, null, 2)}
              </pre>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Feedback</p>
            <p className="mt-1 text-3xl font-bold">
              {upvotes}/{downvotes}
            </p>
            <p className="text-sm leading-6 text-muted">
              Upvotes and downvotes recorded for this item.
            </p>
          </article>

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Review state</p>
            {reviewItems.length === 0 ? (
              <p className="text-sm leading-6 text-muted">
                No review flags are attached to this content.
              </p>
            ) : null}
            {reviewItems.map((item) => (
              <div key={item.id} className="space-y-3">
                <StatusBadge tone={item.resolved ? "neutral" : "warning"}>
                  {item.reason}
                </StatusBadge>
                <p className="text-sm leading-6 text-muted">
                  Confidence {formatScore(item.confidence)}
                </p>
                <p className="text-sm leading-6 text-muted">
                  {item.resolved
                    ? item.resolution || "resolved"
                    : "Awaiting human resolution"}
                </p>
              </div>
            ))}
          </article>

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Promotion state</p>
            {content.newsletter_promotion_at ? (
              <div className="space-y-3 text-sm leading-6 text-muted">
                <p className="m-0">Promoted at {formatDate(content.newsletter_promotion_at)}</p>
                {content.newsletter_promotion_by ? (
                  <p className="m-0">Promoted by editor #{content.newsletter_promotion_by}</p>
                ) : null}
                {content.newsletter_promotion_theme ? (
                  <Link
                    className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-foreground transition hover:bg-primary/12"
                    href={`/themes?project=${selectedProject.id}&theme=${content.newsletter_promotion_theme}`}
                  >
                    Open promoting theme #{content.newsletter_promotion_theme}
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                This content has not been promoted by a theme suggestion yet.
              </p>
            )}
          </article>

          <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Navigate</p>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              href={`/?project=${selectedProject.id}`}
            >
              Back to dashboard
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
              href={`/entities?project=${selectedProject.id}`}
            >
              Manage entities
            </Link>
          </article>
        </aside>
      </section>
    </AppShell>
  )
}
