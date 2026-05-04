import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { NewsletterDraft } from "@/lib/types"

import { DraftsList } from "."

vi.mock("@/components/elements/StatusBadge", () => ({
  StatusBadge: ({ children, tone }: { children: ReactNode; tone: string }) => (
    <span data-testid="status-badge" data-tone={tone}>
      {children}
    </span>
  ),
}))

function createDraft(overrides: Partial<NewsletterDraft> = {}): NewsletterDraft {
  return {
    id: 8,
    project: 1,
    title: "AI Weekly: Delivery signals and more",
    intro: "A quick editor-ready summary.",
    outro: "Closing thought.",
    target_publish_date: "2026-05-08",
    status: "ready",
    generated_at: "2026-05-03T09:00:00Z",
    last_edited_at: null,
    generation_metadata: {
      source_theme_ids: [1, 2],
      source_idea_ids: [4],
      trigger_source: "manual",
      models: { section_composer: "heuristic" },
    },
    sections: [],
    original_pieces: [],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

describe("DraftsList", () => {
  it("renders an empty-state message when no drafts match", () => {
    render(<DraftsList drafts={[]} selectedProjectId={1} />)

    expect(screen.getByText("No newsletter drafts matched the current filter.")).toBeInTheDocument()
  })

  it("renders draft cards and links to the draft detail page", () => {
    render(<DraftsList drafts={[createDraft()]} selectedProjectId={1} />)

    expect(screen.getByText("AI Weekly: Delivery signals and more")).toBeInTheDocument()
    expect(screen.getByText("A quick editor-ready summary.")).toHaveClass(
      "text-muted-foreground",
    )
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Ready")
    expect(screen.getByRole("link", { name: "Open draft" })).toHaveAttribute(
      "href",
      "/drafts/8?project=1",
    )
    expect(screen.getByText("Composer heuristic")).toBeInTheDocument()
  })
})
