import Link from "next/link"

import { StatusBadge } from "@/components/ui/StatusBadge"
import type { ThemeSuggestion, TopicCluster, TopicClusterDetail } from "@/lib/types"
import { formatDate, formatPercentScore } from "@/lib/view-helpers"

export const DEFAULT_THEME_DISMISSAL_REASONS = [
  "off-topic",
  "already covered",
  "not actionable",
] as const

type ThemeSuggestionCardProps = {
  theme: ThemeSuggestion
  projectId: number
  currentPageHref: string
  cluster?: TopicCluster | null
  clusterDetail?: TopicClusterDetail | null
  isHighlighted?: boolean
  dismissalReasons?: readonly string[]
}

/**
 * Render a theme suggestion card with queue actions and supporting context.
 *
 * @param props - Theme suggestion card props.
 * @returns A styled theme suggestion card.
 */
export function ThemeSuggestionCard({
  theme,
  projectId,
  currentPageHref,
  cluster = null,
  clusterDetail = null,
  isHighlighted = false,
  dismissalReasons = DEFAULT_THEME_DISMISSAL_REASONS,
}: ThemeSuggestionCardProps) {
  return (
    <article
      className={`rounded-3xl border p-5 shadow-panel backdrop-blur-xl ${
        isHighlighted ? "border-primary/25 bg-primary/7" : "border-border/12 bg-card/85"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Theme suggestion</p>
          <h2 className="font-display text-title-md font-bold text-foreground">{theme.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{theme.pitch}</p>
        </div>
        <StatusBadge
          tone={
            theme.status === "pending"
              ? "warning"
              : theme.status === "dismissed"
                ? "negative"
                : "positive"
          }
        >
          {theme.status}
        </StatusBadge>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.9fr)]">
        <div className="space-y-4">
          <div>
            <p className="m-0 text-sm font-medium text-foreground">Why it matters</p>
            <p className="mt-2 text-sm leading-6 text-muted">{theme.why_it_matters}</p>
          </div>
          <div>
            <p className="m-0 text-sm font-medium text-foreground">Suggested angle</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {theme.suggested_angle || "No suggested angle was returned for this theme."}
            </p>
          </div>

          {clusterDetail?.memberships.length ? (
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Supporting content preview</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {clusterDetail.memberships.slice(0, 3).map((membership) => (
                  <Link
                    className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground transition hover:bg-muted/80"
                    href={`/content/${membership.content.id}?project=${projectId}`}
                    key={membership.id}
                  >
                    {membership.content.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {theme.promoted_contents.length > 0 ? (
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Promoted contents</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {theme.promoted_contents.map((content) => (
                  <Link
                    className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-foreground transition hover:bg-primary/12"
                    href={`/content/${content.id}?project=${projectId}`}
                    key={content.id}
                  >
                    {content.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-panel bg-muted/60 px-4 py-4">
          <div>
            <p className="m-0 text-sm font-medium text-foreground">Cluster</p>
            {theme.cluster ? (
              <Link
                className="mt-2 inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground transition hover:bg-muted/80"
                href={`/trends?project=${projectId}&cluster=${theme.cluster.id}`}
              >
                {theme.cluster.label || `Cluster ${theme.cluster.id}`}
              </Link>
            ) : (
              <p className="mt-2 text-sm leading-6 text-muted">No cluster is attached to this theme.</p>
            )}
            {cluster?.dominant_entity ? (
              <p className="mt-2 text-sm leading-6 text-muted">
                Dominant entity: {cluster.dominant_entity.name}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-muted">
            <span>Created {formatDate(theme.created_at)}</span>
            <span>Velocity {formatPercentScore(theme.velocity_at_creation)}</span>
            <span>Novelty {formatPercentScore(theme.novelty_score)}</span>
          </div>

          {theme.decided_by_username ? (
            <p className="text-sm leading-6 text-muted">
              Decided by {theme.decided_by_username} on {formatDate(theme.decided_at)}
            </p>
          ) : null}
          {theme.dismissal_reason ? (
            <p className="text-sm leading-6 text-muted">Dismissal reason: {theme.dismissal_reason}</p>
          ) : null}

          {theme.status === "pending" ? (
            <div className="flex flex-wrap items-start gap-3">
              <form action={`/api/projects/${projectId}/themes/${theme.id}/accept`} method="POST">
                <input type="hidden" name="redirectTo" value={currentPageHref} />
                <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" type="submit">
                  Accept
                </button>
              </form>
              <form
                action={`/api/projects/${projectId}/themes/${theme.id}/dismiss`}
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
        </aside>
      </div>
    </article>
  )
}
