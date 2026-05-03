import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { NewsletterDraft } from "@/lib/types"

import { DraftRenderedOutput } from "."

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

describe("DraftRenderedOutput", () => {
  it("renders markdown output when requested", () => {
    render(<DraftRenderedOutput draft={createDraft()} view="markdown" />)

    expect(screen.getByText("Rendered markdown")).toBeInTheDocument()
    expect(screen.getByText("# Draft")).toBeInTheDocument()
  })

  it("renders html output when requested", () => {
    const { container } = render(<DraftRenderedOutput draft={createDraft()} view="html" />)

    expect(screen.getByText("Rendered HTML")).toBeInTheDocument()
    expect(container.querySelector("h1")).toHaveTextContent("Draft")
  })
})