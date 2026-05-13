import { StatusBadge } from "@/components/elements/StatusBadge"
import { Card, CardContent } from "@/components/ui/card"
import type { NewsletterDraft, NewsletterDraftStatus } from "@/lib/types"
import { formatDate, formatDisplayLabel } from "@/lib/view-helpers"

function draftTone(status: NewsletterDraftStatus) {
  switch (status) {
    case "ready":
    case "published":
      return "positive" as const
    case "discarded":
      return "negative" as const
    default:
      return "warning" as const
  }
}

type DraftOverviewCardsProps = {
  draft: NewsletterDraft
}

/** Render the top-line draft metrics and scheduling state. */
export function DraftOverviewCards({ draft }: DraftOverviewCardsProps) {
  return (
    <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Status</p>
          <div className="mt-2">
            <StatusBadge tone={draftTone(draft.status)}>{formatDisplayLabel(draft.status)}</StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Generated {formatDate(draft.generated_at)}
          </p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Sections</p>
          <p className="mt-1 text-3xl font-bold">{draft.sections.length}</p>
          <p className="text-sm leading-6 text-muted-foreground">Theme-backed sections in this edition.</p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Original pieces</p>
          <p className="mt-1 text-3xl font-bold">{draft.original_pieces.length}</p>
          <p className="text-sm leading-6 text-muted-foreground">Accepted original ideas carried into the draft.</p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Target publish</p>
          <p className="mt-1 text-3xl font-bold">{draft.target_publish_date || "Unscheduled"}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {draft.last_edited_at
              ? `Last edited ${formatDate(draft.last_edited_at)}`
              : "No manual edits yet."}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
