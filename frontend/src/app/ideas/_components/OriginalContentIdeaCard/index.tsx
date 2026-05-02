import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import type { OriginalContentIdea } from "@/lib/types"
import { formatDate, formatPercentScore } from "@/lib/view-helpers"

export const DEFAULT_IDEA_DISMISSAL_REASONS = [
  "already assigned",
  "needs stronger evidence",
  "off-topic",
] as const

type OriginalContentIdeaCardProps = {
  /** Original-content idea record shown by the card. */
  idea: OriginalContentIdea
  /** Owning project id used to build action and detail links. */
  projectId: number
  /** Current page URL used for mutation redirects. */
  currentPageHref: string
  /** Optional dismissal reasons offered in the pending-state form. */
  dismissalReasons?: readonly string[]
}

/**
 * Render an original-content idea card with supporting context and workflow actions.
 *
 */
export function OriginalContentIdeaCard({
  idea,
  projectId,
  currentPageHref,
  dismissalReasons = DEFAULT_IDEA_DISMISSAL_REASONS,
}: OriginalContentIdeaCardProps) {
  return (
    <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Original content idea</p>
          <h2 className="font-display text-title-md font-bold text-foreground">{idea.angle_title}</h2>
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
            <p className="m-0 text-sm font-medium text-foreground">Suggested outline</p>
            <div className="mt-2 space-y-2 text-sm leading-6 text-muted">
              {idea.suggested_outline.split("\n").map((line) => (
                <p className="m-0" key={line}>
                  {line}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="m-0 text-sm font-medium text-foreground">Why now</p>
            <p className="mt-2 text-sm leading-6 text-muted">{idea.why_now}</p>
          </div>
          <div>
            <p className="m-0 text-sm font-medium text-foreground">Supporting content</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {idea.supporting_contents.length > 0 ? (
                idea.supporting_contents.map((content) => (
                  <Link
                    className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground transition hover:bg-muted/80"
                    href={`/content/${content.id}?project=${projectId}`}
                    key={content.id}
                  >
                    {content.title}
                  </Link>
                ))
              ) : (
                <p className="m-0 text-sm leading-6 text-muted">
                  No supporting content was attached to this idea.
                </p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4 rounded-panel bg-muted/60 px-4 py-4">
          <div>
            <p className="m-0 text-sm font-medium text-foreground">Workflow metadata</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
              <span>Created {formatDate(idea.created_at)}</span>
              <span>Score {formatPercentScore(idea.self_critique_score)}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">Model: {idea.generated_by_model}</p>
            {idea.related_cluster ? (
              <Link
                className="mt-2 inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground transition hover:bg-muted/80"
                href={`/trends?project=${projectId}&cluster=${idea.related_cluster.id}`}
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
            <p className="text-sm leading-6 text-muted">Dismissal reason: {idea.dismissal_reason}</p>
          ) : null}

          {idea.status === "pending" ? (
            <div className="flex flex-wrap items-start gap-3">
              <form action={`/api/projects/${projectId}/ideas/${idea.id}/accept`} method="POST">
                <input type="hidden" name="redirectTo" value={currentPageHref} />
                <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                  Accept
                </button>
              </form>
              <form
                action={`/api/projects/${projectId}/ideas/${idea.id}/dismiss`}
                className="flex flex-wrap items-center gap-3"
                method="POST"
              >
                <input type="hidden" name="redirectTo" value={currentPageHref} />
                <select
                  aria-label="Dismissal reason"
                  className="min-h-11 rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  defaultValue={dismissalReasons[0]}
                  name="reason"
                >
                  {dismissalReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
                <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                  Dismiss
                </button>
              </form>
            </div>
          ) : null}

          {idea.status === "accepted" ? (
            <form action={`/api/projects/${projectId}/ideas/${idea.id}/mark-written`} method="POST">
              <input type="hidden" name="redirectTo" value={currentPageHref} />
              <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                Mark written
              </button>
            </form>
          ) : null}
        </aside>
      </div>
    </article>
  )
}
