import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CandidateQueueOverview } from "."

describe("CandidateQueueOverview", () => {
  it("renders summary cards and route tabs", () => {
    render(
      <CandidateQueueOverview
        activeTab="review"
        clusterCount={3}
        pendingCount={5}
        resolvedCount={2}
        selectedProjectId={7}
      />
    )

    expect(screen.getByText("Clusters")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getAllByText("Auto-promotion log").length).toBeGreaterThan(0)
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Review clusters" })).toHaveAttribute(
      "href",
      "/entities/candidates?project=7"
    )
    expect(screen.getByRole("link", { name: "Auto-promotion log" })).toHaveAttribute(
      "href",
      "/entities/candidates?project=7&tab=auto-log"
    )
    expect(screen.getByRole("link", { name: "Back to entities" })).toHaveAttribute(
      "href",
      "/entities?project=7"
    )
  })
})
