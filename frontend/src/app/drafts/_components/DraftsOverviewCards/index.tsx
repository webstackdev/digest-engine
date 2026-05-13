import { Card, CardContent } from "@/components/ui/card"
import type { NewsletterDraft, NewsletterDraftStatus } from "@/lib/types"

type DraftsOverviewCardsProps = {
  /** Drafts for the selected project before any status filtering is applied. */
  drafts: NewsletterDraft[]
}

function countDraftsByStatus(drafts: NewsletterDraft[], status: NewsletterDraftStatus) {
  return drafts.filter((draft) => draft.status === status).length
}

/** Render top-line counts for the project draft queue. */
export function DraftsOverviewCards({ drafts }: DraftsOverviewCardsProps) {
  return (
    <section className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Generating</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "generating")}</p>
          <p className="text-sm leading-6 text-muted-foreground">Drafts currently being composed.</p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Ready</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "ready")}</p>
          <p className="text-sm leading-6 text-muted-foreground">Drafts ready for editorial review.</p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Edited</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "edited")}</p>
          <p className="text-sm leading-6 text-muted-foreground">Drafts with local editorial changes.</p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Published</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "published")}</p>
          <p className="text-sm leading-6 text-muted-foreground">Drafts marked published in the backend.</p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Discarded</p>
          <p className="mt-1 text-3xl font-bold">{countDraftsByStatus(drafts, "discarded")}</p>
          <p className="text-sm leading-6 text-muted-foreground">Drafts that ended in an error state.</p>
        </CardContent>
      </Card>
    </section>
  )
}
