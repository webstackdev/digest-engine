import { Card, CardContent } from "@/components/ui/card"
import type { NewsletterDraft } from "@/lib/types"

import type { DraftView } from "../DraftViewSwitcher"

type DraftRenderedOutputProps = {
  draft: NewsletterDraft
  view: DraftView
}

/** Render the markdown or HTML export view for a newsletter draft. */
export function DraftRenderedOutput({ draft, view }: DraftRenderedOutputProps) {
  if (view === "markdown") {
    return (
      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Rendered markdown</p>
          <pre className="mt-4 overflow-auto rounded-2xl bg-sidebar/95 p-4 text-sm text-sidebar-foreground">
            {draft.rendered_markdown}
          </pre>
        </CardContent>
      </Card>
    )
  }

  if (view === "html") {
    return (
      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="pt-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Rendered HTML</p>
          <article
            className="prose prose-sm mt-4 max-w-none text-foreground dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: draft.rendered_html }}
          />
        </CardContent>
      </Card>
    )
  }

  return null
}
