import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { NewsletterDraft, NewsletterDraftStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate, formatDisplayLabel } from "@/lib/view-helpers"

type DraftsListProps = {
  /** Drafts after the current status filter has been applied. */
  drafts: NewsletterDraft[]
  /** Current project selection reused when linking into the draft detail route. */
  selectedProjectId: number
}

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

/** Render the filtered draft cards for the selected project. */
export function DraftsList({ drafts, selectedProjectId }: DraftsListProps) {
  return (
    <section className="space-y-4">
      {drafts.length === 0 ? (
        <Card className="rounded-panel border-0 bg-muted/60 shadow-none">
          <CardContent className="px-4 py-4 text-sm leading-6 text-muted-foreground">
            No newsletter drafts matched the current filter.
          </CardContent>
        </Card>
      ) : null}

      {drafts.map((draft) => (
        <Card key={draft.id} className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
          <CardContent className="pt-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Draft #{draft.id}</p>
                <h2 className="font-display text-title-md font-bold text-foreground">{draft.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {draft.intro || "No intro has been added yet."}
                </p>
              </div>
              <StatusBadge tone={draftTone(draft.status)}>{formatDisplayLabel(draft.status)}</StatusBadge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>Generated {formatDate(draft.generated_at)}</span>
              <span>
                {draft.sections.length} section{draft.sections.length === 1 ? "" : "s"}
              </span>
              <span>
                {draft.original_pieces.length} original piece
                {draft.original_pieces.length === 1 ? "" : "s"}
              </span>
              <span>Target publish {draft.target_publish_date || "Unscheduled"}</span>
              {draft.last_edited_at ? <span>Edited {formatDate(draft.last_edited_at)}</span> : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
                href={`/drafts/${draft.id}?project=${selectedProjectId}`}
              >
                Open draft
              </Link>
              {draft.generation_metadata.models ? (
                <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                  Composer {draft.generation_metadata.models.section_composer || "pending"}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
