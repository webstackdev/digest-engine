import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TrendsQueueOverview } from "."

describe("TrendsQueueOverview", () => {
  it("renders summary metrics", () => {
    render(
      <TrendsQueueOverview
        averageVelocityScore={0.52}
        contentCount={18}
        daysFilter={14}
        visibleClusterCount={3}
      />,
    )

    expect(screen.getByText("Visible clusters")).toBeInTheDocument()
    expect(screen.getByText("Tracked content")).toBeInTheDocument()
    expect(screen.getByText("18")).toBeInTheDocument()
  })
})