import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Content } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  formatDate,
  formatDisplayLabel,
  formatPercentScore,
  truncateText,
} from "@/lib/view-helpers"

import type { ContentClusterBadge } from "../shared"

type ContentFeedProps = {
  projectId: number
  filteredContents: Content[]
  contentClusterLookup: Map<number, ContentClusterBadge>
}

/** Render the surfaced content cards and quick editorial actions. */
export function ContentFeed({
  projectId,
  filteredContents,
  contentClusterLookup,
}: ContentFeedProps) {
  return (
    <div className="space-y-4">
      {filteredContents.length === 0 ? (
        <Alert className="rounded-panel border-border/10 bg-muted/60">
          <AlertDescription>No content matched the current filters.</AlertDescription>
        </Alert>
      ) : null}
      {filteredContents.map((content) => {
        const trendCluster = contentClusterLookup.get(content.id)

        return (
          <Card
            className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl"
            key={content.id}
          >
            <CardContent className="grid gap-4 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <h3 className="font-display text-title-md font-bold">{content.title}</h3>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{formatDate(content.published_date)}</span>
                    <span>{content.author || "Unknown author"}</span>
                    <span>{formatDisplayLabel(content.source_plugin)}</span>
                  </div>
                </div>
                <StatusBadge
                  tone={
                    (content.authority_adjusted_score ?? content.relevance_score ?? 0) >= 0.7
                      ? "positive"
                      : "warning"
                  }
                >
                  Adjusted {formatPercentScore(content.authority_adjusted_score ?? content.relevance_score)}
                </StatusBadge>
              </div>

              <div className="flex flex-wrap gap-2">
                {trendCluster ? (
                  <Link
                    className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "rounded-full px-3")}
                    href={`/trends?project=${projectId}&cluster=${trendCluster.clusterId}`}
                  >
                    Trend {trendCluster.label} · {formatPercentScore(trendCluster.velocityScore ?? null)}
                  </Link>
                ) : null}
                {content.authority_adjusted_score !== null ? (
                  <span className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-foreground">
                    Base {formatPercentScore(content.relevance_score)}
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                  {formatDisplayLabel(content.content_type || "unclassified")}
                </span>
                {content.duplicate_signal_count > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                    Also seen in {content.duplicate_signal_count} source
                    {content.duplicate_signal_count === 1 ? "" : "s"}
                  </span>
                ) : null}
                {content.duplicate_of ? (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                    Duplicate of #{content.duplicate_of}
                  </span>
                ) : null}
                {content.is_reference ? (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">reference</span>
                ) : null}
                {!content.is_active ? (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">archived</span>
                ) : null}
                {content.newsletter_promotion_at ? (
                  <Link
                    className={cn(buttonVariants({ size: "sm", variant: "secondary" }), "rounded-full px-3")}
                    href={content.newsletter_promotion_theme ? `/themes?project=${projectId}&theme=${content.newsletter_promotion_theme}` : `/themes?project=${projectId}`}
                  >
                    Promoted {formatDate(content.newsletter_promotion_at)}
                  </Link>
                ) : null}
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{truncateText(content.content_text)}</p>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  className={cn(buttonVariants({ size: "lg" }), "min-h-11 rounded-full px-4 py-3")}
                  href={`/content/${content.id}?project=${projectId}`}
                >
                  Open detail
                </Link>
                <form action="/api/feedback" method="POST">
                  <input name="projectId" type="hidden" value={projectId} />
                  <input name="contentId" type="hidden" value={content.id} />
                  <input name="feedbackType" type="hidden" value="upvote" />
                  <input name="redirectTo" type="hidden" value={`/?project=${projectId}`} />
                  <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                    Upvote
                  </Button>
                </form>
                <form action="/api/feedback" method="POST">
                  <input name="projectId" type="hidden" value={projectId} />
                  <input name="contentId" type="hidden" value={content.id} />
                  <input name="feedbackType" type="hidden" value="downvote" />
                  <input name="redirectTo" type="hidden" value={`/?project=${projectId}`} />
                  <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="outline">
                    Downvote
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
