import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { NewsletterDraft } from "@/lib/types"

import { DraftsOverviewCards } from "."

function createDraft(overrides: Partial<NewsletterDraft> = {}): NewsletterDraft {
  return {
    id: 8,
    project: 1,
    title: "Draft",
    intro: "Intro",
    outro: "Outro",
    target_publish_date: "2026-05-08",
    status: "ready",
    generated_at: "2026-05-03T09:00:00Z",
    last_edited_at: null,
    generation_metadata: {
      source_theme_ids: [],
      source_idea_ids: [],
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

describe("DraftsOverviewCards", () => {
  it("renders draft counts for each lifecycle state", () => {
    render(
      <DraftsOverviewCards
        drafts={[
          createDraft({ id: 1, status: "generating" }),
          createDraft({ id: 2, status: "ready" }),
          createDraft({ id: 3, status: "edited" }),
          createDraft({ id: 4, status: "published" }),
          createDraft({ id: 5, status: "discarded" }),
        ]}
      />,
    )

    expect(screen.getByText("Drafts currently being composed.")).toHaveClass(
      "text-muted-foreground",
    )
    expect(screen.getByText("Drafts ready for editorial review.")).toBeInTheDocument()
    expect(screen.getByText("Drafts with local editorial changes.")).toBeInTheDocument()
    expect(screen.getByText("Drafts marked published in the backend.")).toBeInTheDocument()
    expect(screen.getByText("Drafts that ended in an error state.")).toBeInTheDocument()
    expect(screen.getAllByText("1")).toHaveLength(5)
  })
})
