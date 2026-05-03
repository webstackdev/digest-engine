import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { IdeasQueueOverview } from "."

describe("IdeasQueueOverview", () => {
  it("renders all queue summary metrics", () => {
    render(
      <IdeasQueueOverview
        acceptedCount={2}
        dismissedCount={1}
        pendingCount={4}
        writtenCount={3}
      />,
    )

    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("Accepted")).toBeInTheDocument()
    expect(screen.getByText("Written")).toBeInTheDocument()
    expect(screen.getByText("Dismissed")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
  })
})
