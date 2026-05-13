import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { Content, ReviewQueueItem } from "@/lib/types"

import { ContentDetailSidebar } from "."

vi.mock("@/components/elements/StatusBadge", () => ({
  StatusBadge: ({
    children,
    tone,
  }: {
    children: ReactNode
    tone: string
  }) => (
    <span data-testid="status-badge" data-tone={tone}>
      {children}
    </span>
  ),
}))

function createContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 42,
    project: 1,
    url: "https://example.com/article",
    title: "Important AI update",
    author: "Ada Lovelace",
    entity: null,
    source_plugin: "rss",
    content_type: "article",
    canonical_url: "https://example.com/article",
    published_date: "2026-04-28T09:00:00Z",
    ingested_at: "2026-04-28T10:00:00Z",
    content_text: "Body copy",
    relevance_score: 0.82,
    authority_adjusted_score: 0.86,
    embedding_id: "embed-1",
    duplicate_of: null,
    duplicate_signal_count: 0,
    is_reference: false,
    is_active: true,
    newsletter_promotion_at: null,
    newsletter_promotion_by: null,
    newsletter_promotion_theme: null,
    ...overrides,
  }
}

function createReviewQueueItem(
  overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
  return {
    id: 9,
    project: 1,
    content: 42,
    reason: "borderline_relevance",
    confidence: 0.62,
    created_at: "2026-04-28T10:10:00Z",
    resolved: false,
    resolution: "",
    ...overrides,
  }
}

describe("ContentDetailSidebar", () => {
  it("renders feedback, review, promotion, and navigation state", () => {
    const { container } = render(
      <ContentDetailSidebar
        content={createContent({
          newsletter_promotion_at: "2026-04-28T12:00:00Z",
          newsletter_promotion_by: 6,
          newsletter_promotion_theme: 14,
        })}
        downvotes={1}
        reviewItems={[
          createReviewQueueItem(),
          createReviewQueueItem({
            id: 10,
            reason: "low_confidence_classification",
            resolved: true,
            resolution: "human_approved",
          }),
        ]}
        selectedProjectId={1}
        upvotes={2}
      />,
    )

    expect(screen.getByText("2/1")).toBeInTheDocument()
    expect(screen.getByText("Awaiting human resolution")).toBeInTheDocument()
    expect(screen.getByText("Human approved")).toBeInTheDocument()
    expect(screen.getByText("Promoted by editor #6")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Open promoting theme #14" }),
    ).toHaveAttribute("href", "/themes?project=1&theme=14")
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
      "href",
      "/?project=1",
    )
    expect(screen.getByRole("link", { name: "Manage entities" })).toHaveAttribute(
      "href",
      "/entities?project=1",
    )
    expect(container.querySelector("aside .flex.flex-wrap.items-center.justify-center.gap-3")).not.toBeNull()
  })

  it("renders empty-state review and promotion copy", () => {
    const { container } = render(
      <ContentDetailSidebar
        content={createContent()}
        downvotes={0}
        reviewItems={[]}
        selectedProjectId={1}
        upvotes={0}
      />,
    )

    expect(
      screen.getByText("No review flags are attached to this content."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("This content has not been promoted by a theme suggestion yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No review flags are attached to this content."),
    ).toHaveClass("text-content-offset")
    expect(
      screen.getByText("This content has not been promoted by a theme suggestion yet."),
    ).toHaveClass("text-content-offset")
    expect(screen.getByText("Review state")).toHaveClass("mb-3")
    expect(screen.getByText("Promotion state")).toHaveClass("mb-3")
    expect(screen.getByText("Navigate")).toHaveClass("mb-3")
    expect(
      container.querySelector("aside .flex.flex-wrap.items-center.justify-center.gap-3"),
    ).not.toBeNull()
  })
})
