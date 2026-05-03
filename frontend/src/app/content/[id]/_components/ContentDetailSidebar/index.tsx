import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Content, ReviewQueueItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate, formatScore } from "@/lib/view-helpers"

type ContentDetailSidebarProps = {
  content: Content
  selectedProjectId: number
  upvotes: number
  downvotes: number
  reviewItems: ReviewQueueItem[]
}

/** Render the feedback, review, promotion, and navigation sidebar cards. */
export function ContentDetailSidebar({
  content,
  selectedProjectId,
  upvotes,
  downvotes,
  reviewItems,
}: ContentDetailSidebarProps) {
  return (
    <aside className="space-y-4">
      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Feedback</p>
          <p className="mt-1 text-3xl font-bold">
            {upvotes}/{downvotes}
          </p>
          <p className="text-sm leading-6 text-muted">
            Upvotes and downvotes recorded for this item.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-4 pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Review state</p>
          {reviewItems.length === 0 ? (
            <p className="text-sm leading-6 text-muted">
              No review flags are attached to this content.
            </p>
          ) : null}
          {reviewItems.map((item) => (
            <div className="space-y-3" key={item.id}>
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
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-4 pt-5">
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
                  href={`/themes?project=${selectedProjectId}&theme=${content.newsletter_promotion_theme}`}
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
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-3 pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Navigate</p>
          <Link
            className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
            href={`/?project=${selectedProjectId}`}
          >
            Back to dashboard
          </Link>
          <Link
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}
            href={`/entities?project=${selectedProjectId}`}
          >
            Manage entities
          </Link>
        </CardContent>
      </Card>
    </aside>
  )
}