import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DashboardOverview } from "."

describe("DashboardOverview", () => {
  it("renders dashboard summary metrics", () => {
    render(
      <DashboardOverview
        negativeFeedback={2}
        positiveFeedback={5}
        reviewQueueCount={3}
        surfacedCount={12}
        trackedEntitiesCount={8}
      />,
    )

    expect(screen.getByText("Surfaced")).toBeInTheDocument()
    expect(screen.getByText("Review queue")).toBeInTheDocument()
    expect(screen.getByText("Tracked entities")).toBeInTheDocument()
    expect(screen.getByText("5/2")).toBeInTheDocument()
  })
})