import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ThemesQueueOverview } from "."

describe("ThemesQueueOverview", () => {
  it("renders the queue metrics", () => {
    render(
      <ThemesQueueOverview
        acceptedCount={2}
        dismissedCount={1}
        pendingCount={3}
        totalCount={6}
      />,
    )

    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("Accepted or used")).toBeInTheDocument()
    expect(screen.getByText("Dismissed")).toBeInTheDocument()
    expect(screen.getByText("Total themes")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })
})