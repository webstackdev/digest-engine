import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { NewsletterDraft } from "@/lib/types"

import { DraftOverviewCards } from "."

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
      coherence_suggestions: ["Tighten the intro transition."],
    },
    sections: [],
    original_pieces: [],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

describe("DraftOverviewCards", () => {
  it("renders the draft status and aggregate counts", () => {
    render(
      <DraftOverviewCards
        draft={createDraft({
          sections: [{ id: 1 } as NewsletterDraft["sections"][number]],
          original_pieces: [
            { id: 1 } as NewsletterDraft["original_pieces"][number],
          ],
        })}
      />,
    )

    expect(screen.getByTestId("status-badge")).toHaveTextContent("ready")
    expect(screen.getByText("Theme-backed sections in this edition.")).toBeInTheDocument()
    expect(screen.getByText("Accepted original ideas carried into the draft.")).toBeInTheDocument()
    expect(screen.getByText("2026-05-08")).toBeInTheDocument()
    expect(screen.getByText("No manual edits yet.")).toBeInTheDocument()
  })
})