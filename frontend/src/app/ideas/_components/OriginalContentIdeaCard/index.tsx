import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { Badge } from "@/components/ui/badge"
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
import type { OriginalContentIdea } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate, formatDisplayLabel, formatPercentScore } from "@/lib/view-helpers"

import {
  DEFAULT_IDEA_DISMISSAL_REASONS,
  selectTriggerClassName,
} from "../shared"

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
    <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="pt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Original content idea</p>
            <h2 className="font-display text-title-md font-bold text-foreground">{idea.angle_title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{idea.summary}</p>
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
            {formatDisplayLabel(idea.status)}
          </StatusBadge>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.95fr)]">
          <div className="space-y-4">
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Suggested outline</p>
              <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                {idea.suggested_outline.split("\n").map((line) => (
                  <p className="m-0" key={line}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Why now</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{idea.why_now}</p>
            </div>
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Supporting content</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {idea.supporting_contents.length > 0 ? (
                  idea.supporting_contents.map((content) => (
                    <Link
                      className={cn(
                        buttonVariants({ size: "sm", variant: "outline" }),
                        "rounded-full px-3",
                      )}
                      href={`/content/${content.id}?project=${projectId}`}
                      key={content.id}
                    >
                      {content.title}
                    </Link>
                  ))
                ) : (
                  <p className="m-0 text-sm leading-6 text-muted-foreground">
                    No supporting content was attached to this idea.
                  </p>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl border border-border/10 bg-muted/45 p-4">
            <div>
              <p className="m-0 text-sm font-medium text-foreground">Workflow metadata</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>Created {formatDate(idea.created_at)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="rounded-full px-3 py-1 text-sm" variant="secondary">
                  {idea.generated_by_model}
                </Badge>
                <Badge className="rounded-full px-3 py-1 text-sm" variant="outline">
                  Score {formatPercentScore(idea.self_critique_score)}
                </Badge>
              </div>
              {idea.related_cluster ? (
                <Link
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "mt-3 rounded-full px-3",
                  )}
                  href={`/trends?project=${projectId}&cluster=${idea.related_cluster.id}`}
                >
                  {idea.related_cluster.label || `Cluster ${idea.related_cluster.id}`}
                </Link>
              ) : null}
            </div>

            {idea.decided_by_username ? (
              <p className="text-sm leading-6 text-muted-foreground">
                Decided by {idea.decided_by_username} on {formatDate(idea.decided_at)}
              </p>
            ) : null}
            {idea.dismissal_reason ? (
              <p className="text-sm leading-6 text-muted-foreground">Dismissal reason: {formatDisplayLabel(idea.dismissal_reason)}</p>
            ) : null}

            {idea.status === "pending" ? (
              <div className="flex flex-wrap items-start gap-3">
                <form action={`/api/projects/${projectId}/ideas/${idea.id}/accept`} method="POST">
                  <input name="redirectTo" type="hidden" value={currentPageHref} />
                  <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                    Accept
                  </Button>
                </form>
                <form
                  action={`/api/projects/${projectId}/ideas/${idea.id}/dismiss`}
                  className="flex flex-wrap items-center gap-3"
                  method="POST"
                >
                  <input name="redirectTo" type="hidden" value={currentPageHref} />
                  <div className="grid gap-2">
                    <Label className="sr-only" htmlFor={`idea-${idea.id}-dismissal-reason`}>
                      Dismissal reason
                    </Label>
                    <Select defaultValue={dismissalReasons[0]} name="reason">
                      <SelectTrigger className={cn(selectTriggerClassName, "md:min-w-56")} id={`idea-${idea.id}-dismissal-reason`}>
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

            {idea.status === "accepted" ? (
              <form action={`/api/projects/${projectId}/ideas/${idea.id}/mark-written`} method="POST">
                <input name="redirectTo" type="hidden" value={currentPageHref} />
                <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                  Mark written
                </Button>
              </form>
            ) : null}
          </aside>
        </div>
      </CardContent>
    </Card>
  )
}
