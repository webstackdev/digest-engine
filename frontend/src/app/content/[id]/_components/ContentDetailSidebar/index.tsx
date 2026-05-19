import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Content, ReviewQueueItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate, formatDisplayLabel, formatScore } from "@/lib/view-helpers"

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
      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardContent className="p-5">
          <p className="mb-3 text-eyebrow uppercase tracking-eyebrow opacity-70">Feedback</p>
          <p className="mt-1 text-3xl font-bold">
            {upvotes}/{downvotes}
          </p>
          <p className="text-sm leading-6 text-content-offset">
            Upvotes and downvotes recorded for this item.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-4 p-5">
          <p className="mb-3 text-eyebrow uppercase tracking-eyebrow opacity-70">Review state</p>
          {reviewItems.length === 0 ? (
            <p className="text-sm leading-6 text-content-offset">
              No review flags are attached to this content.
            </p>
          ) : null}
          {reviewItems.map((item) => (
            <div className="space-y-3" key={item.id}>
              <StatusBadge tone={item.resolved ? "neutral" : "warning"}>
                {formatDisplayLabel(item.reason)}
              </StatusBadge>
              <p className="text-sm leading-6 text-content-offset">
                Confidence {formatScore(item.confidence)}
              </p>
              <p className="text-sm leading-6 text-content-offset">
                {item.resolved
                  ? formatDisplayLabel(item.resolution || "resolved")
                  : "Awaiting human resolution"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-4 p-5">
          <p className="mb-3 text-eyebrow uppercase tracking-eyebrow opacity-70">Promotion state</p>
          {content.newsletter_promotion_at ? (
            <div className="space-y-3 text-sm leading-6 text-content-offset">
              <p className="m-0">Promoted at {formatDate(content.newsletter_promotion_at)}</p>
              {content.newsletter_promotion_by ? (
                <p className="m-0">Promoted by editor #{content.newsletter_promotion_by}</p>
              ) : null}
              {content.newsletter_promotion_theme ? (
                <Link
                  className="inline-flex items-center rounded-full border border-primary bg-primary px-3 py-1 text-sm text-content-active transition hover:bg-primary"
                  href={`/themes?project=${selectedProjectId}&theme=${content.newsletter_promotion_theme}`}
                >
                  Open promoting theme #{content.newsletter_promotion_theme}
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-6 text-content-offset">
              This content has not been promoted by a theme suggestion yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardContent className="p-5">
          <p className="mb-3 text-eyebrow uppercase tracking-eyebrow opacity-70">Navigate</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              className={cn(buttonVariants({ size: "sm" }), "min-h-10 rounded-full px-4")}
              href={`/?project=${selectedProjectId}`}
            >
              Back to dashboard
            </Link>
            <Link
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "min-h-10 rounded-full px-4")}
              href={`/entities?project=${selectedProjectId}`}
            >
              Manage entities
            </Link>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
