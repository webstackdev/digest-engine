import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ThemeSuggestion, TopicCluster, TopicClusterDetail } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate, formatDisplayLabel, formatPercentScore } from "@/lib/view-helpers"

import { DEFAULT_THEME_DISMISSAL_REASONS } from "../shared"

type ThemeSuggestionCardProps = {
  /** Theme suggestion record shown by the card. */
  theme: ThemeSuggestion
  /** Owning project id used to build action and detail links. */
  projectId: number
  /** Current page URL used for mutation redirects. */
  currentPageHref: string
  /** Optional cluster summary used for extra context. */
  cluster?: TopicCluster | null
  /** Optional cluster detail used for supporting content preview. */
  clusterDetail?: TopicClusterDetail | null
  /** Whether the card should render in its highlighted state. */
  isHighlighted?: boolean
  /** Optional dismissal reasons offered in the pending-state form. */
  dismissalReasons?: readonly string[]
}

/**
 * Render a theme suggestion card with queue actions and supporting context.
 *
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
    <Card
      className={cn(
        "rounded-3xl border shadow-panel backdrop-blur-xl",
        isHighlighted ? "border-primary bg-primary" : "border-border bg-card",
      )}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Theme suggestion</p>
            <h2 className="font-display text-title-md font-bold text-foreground">{theme.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{theme.pitch}</p>
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
            {formatDisplayLabel(theme.status)}
          </StatusBadge>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.9fr)]">
          <div className="space-y-4">
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Why it matters</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{theme.why_it_matters}</p>
            </div>
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Suggested angle</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {theme.suggested_angle || "No suggested angle was returned for this theme."}
              </p>
            </div>

            {clusterDetail?.memberships.length ? (
              <div>
                <p className="m-0 text-sm font-medium text-foreground">Supporting content preview</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {clusterDetail.memberships.slice(0, 3).map((membership) => (
                    <Link
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full px-3")}
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
                      className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "rounded-full px-3")}
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

          <aside className="space-y-4 rounded-panel bg-muted px-4 py-4">
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Cluster</p>
              {theme.cluster ? (
                <Link
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-2 rounded-full px-3")}
                  href={`/trends?project=${projectId}&cluster=${theme.cluster.id}`}
                >
                  {theme.cluster.label || `Cluster ${theme.cluster.id}`}
                </Link>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">No cluster is attached to this theme.</p>
              )}
              {cluster?.dominant_entity ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Dominant entity: {cluster.dominant_entity.name}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>Created {formatDate(theme.created_at)}</span>
              <span>Velocity {formatPercentScore(theme.velocity_at_creation)}</span>
              <span>Novelty {formatPercentScore(theme.novelty_score)}</span>
            </div>

            {theme.decided_by_username ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Decided by {theme.decided_by_username} on {formatDate(theme.decided_at)}
              </p>
            ) : null}
            {theme.dismissal_reason ? (
              <p className="text-sm leading-6 text-muted-foreground">Dismissal reason: {formatDisplayLabel(theme.dismissal_reason)}</p>
            ) : null}

            {theme.status === "pending" ? (
              <div className="flex flex-wrap items-start gap-3">
                <form action={`/api/projects/${projectId}/themes/${theme.id}/accept`} method="POST">
                  <input type="hidden" name="redirectTo" value={currentPageHref} />
                  <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                    Accept
                  </Button>
                </form>
                <form
                  action={`/api/projects/${projectId}/themes/${theme.id}/dismiss`}
                  className="flex flex-wrap items-center gap-3"
                  method="POST"
                >
                  <input type="hidden" name="redirectTo" value={currentPageHref} />
                  <div className="grid gap-2">
                    <Label className="sr-only" htmlFor={`dismiss-reason-${theme.id}`}>
                      Dismissal reason
                    </Label>
                    <Select defaultValue={dismissalReasons[0]} name="reason">
                      <SelectTrigger
                        className="min-h-11 rounded-2xl border-border bg-muted px-4 py-3 text-sm text-foreground"
                        id={`dismiss-reason-${theme.id}`}
                      >
                        <SelectValue placeholder="Dismissal reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {dismissalReasons.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="outline">
                    Dismiss
                  </Button>
                </form>
              </div>
            ) : null}
          </aside>
        </div>
      </CardContent>
    </Card>
  )
}
