import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createContent } from "@/lib/storybook-fixtures"

import { ContentFeed } from "."

describe("ContentFeed", () => {
  it("renders the empty state when no content matches", () => {
    render(<ContentFeed contentClusterLookup={new Map()} filteredContents={[]} projectId={1} />)

    expect(screen.getByText("No content matched the current filters.")).toBeInTheDocument()
  })

  it("renders content cards, trend badges, and quick actions", () => {
    const content = createContent({
      is_reference: true,
      newsletter_promotion_at: "2026-04-28T11:00:00Z",
      newsletter_promotion_theme: 14,
    })

    render(
      <ContentFeed
        contentClusterLookup={
          new Map([
            [
              content.id,
              { clusterId: 5, label: "Platform Signals", velocityScore: 0.81 },
            ],
          ])
        }
        filteredContents={[content]}
        projectId={1}
      />,
    )

    expect(screen.getByText(content.title)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Trend Platform Signals/i })).toHaveAttribute(
      "href",
      "/trends?project=1&cluster=5",
    )
    expect(screen.getByText("Base 84%")).toBeInTheDocument()
    expect(screen.getByText("reference")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Upvote" })).toBeInTheDocument()
  })
})