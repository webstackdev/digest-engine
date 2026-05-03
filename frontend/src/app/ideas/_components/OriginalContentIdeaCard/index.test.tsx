import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createOriginalContentIdea } from "@/lib/storybook-fixtures"

import { OriginalContentIdeaCard } from "."

describe("OriginalContentIdeaCard", () => {
  it("renders pending idea actions and supporting links", () => {
    const { container } = render(
      <OriginalContentIdeaCard
        currentPageHref="/ideas?project=1"
        idea={createOriginalContentIdea()}
        projectId={1}
      />,
    )

    expect(screen.getByText("Explain the operator gap")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Useful AI briefing" })).toHaveAttribute(
      "href",
      "/content/41?project=1",
    )
    expect(screen.getByRole("link", { name: "Platform Signals" })).toHaveAttribute(
      "href",
      "/trends?project=1&cluster=5",
    )
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument()
    expect(container.querySelector('input[name="reason"]')).toHaveValue("already assigned")
  })

  it("renders accepted ideas with mark-written action and fallback content copy", () => {
    render(
      <OriginalContentIdeaCard
        currentPageHref="/ideas?project=1&status=accepted"
        idea={createOriginalContentIdea({
          status: "accepted",
          supporting_contents: [],
          decided_at: "2026-04-29T09:00:00Z",
          decided_by: 5,
          decided_by_username: "editor-2",
        })}
        projectId={1}
      />,
    )

    expect(screen.getByText("No supporting content was attached to this idea.")).toBeInTheDocument()
    expect(screen.getByText(/Decided by editor-2/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mark written" })).toBeInTheDocument()
  })
})
