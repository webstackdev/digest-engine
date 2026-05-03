import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DraftView = "editor" | "markdown" | "html"

type DraftViewSwitcherProps = {
  selectedProjectId: number
  draftId: number
  currentView: DraftView
}

export function buildDraftDetailHref(
  projectId: number,
  draftId: number,
  view: DraftView,
) {
  const params = new URLSearchParams({ project: String(projectId) })
  if (view !== "editor") {
    params.set("view", view)
  }
  return `/drafts/${draftId}?${params.toString()}`
}

/** Render the draft-detail view switcher and back-navigation links. */
export function DraftViewSwitcher({
  selectedProjectId,
  draftId,
  currentView,
}: DraftViewSwitcherProps) {
  return (
    <Card className="mb-4 rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="flex flex-wrap items-center gap-3 pt-5">
        <Link
          className={cn(
            buttonVariants({
              size: "lg",
              variant: currentView === "editor" ? "default" : "outline",
            }),
            "rounded-full",
          )}
          href={buildDraftDetailHref(selectedProjectId, draftId, "editor")}
        >
          Editor view
        </Link>
        <Link
          className={cn(
            buttonVariants({
              size: "lg",
              variant: currentView === "markdown" ? "default" : "outline",
            }),
            "rounded-full",
          )}
          href={buildDraftDetailHref(selectedProjectId, draftId, "markdown")}
        >
          Markdown export
        </Link>
        <Link
          className={cn(
            buttonVariants({
              size: "lg",
              variant: currentView === "html" ? "default" : "outline",
            }),
            "rounded-full",
          )}
          href={buildDraftDetailHref(selectedProjectId, draftId, "html")}
        >
          HTML export
        </Link>
        <Link
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}
          href={`/drafts?project=${selectedProjectId}`}
        >
          Back to drafts
        </Link>
      </CardContent>
    </Card>
  )
}
