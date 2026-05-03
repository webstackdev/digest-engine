import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createContent } from "@/lib/storybook-fixtures"
import type { Content, ReviewQueueItem } from "@/lib/types"

import { ReviewQueueTable } from "."

function createReviewQueueItem(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    id: 7,
    project: 1,
    content: 41,
    reason: "borderline_relevance",
    confidence: 0.61,
    created_at: "2026-04-28T12:00:00Z",
    resolved: false,
    resolution: "",
    ...overrides,
  }
}

describe("ReviewQueueTable", () => {
  it("renders the empty state when no review items exist", () => {
    render(<ReviewQueueTable contentMap={new Map()} pendingReviewItems={[]} projectId={1} />)

    expect(
      screen.getByText("No unresolved review items for this project right now."),
    ).toBeInTheDocument()
  })

  it("renders queue rows with fallback metadata and actions", () => {
    const content = createContent({ duplicate_of: 18, duplicate_signal_count: 2 })
    const contentMap = new Map<number, Content>([[content.id, content]])

    render(
      <ReviewQueueTable
        contentMap={contentMap}
        pendingReviewItems={[createReviewQueueItem()]}
        projectId={1}
      />,
    )

    expect(screen.getByText("Useful AI briefing", { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText("Also seen in 2 sources")).toBeInTheDocument()
    expect(screen.getByText("Duplicate of #18")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()
  })
})