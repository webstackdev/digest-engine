import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatusBadge } from "@/components/elements/StatusBadge"

describe("StatusBadge", () => {
  it("renders its children and tone attribute", () => {
    render(<StatusBadge tone="warning">Needs review</StatusBadge>)

    const badge = screen.getByText("Needs review")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute("data-tone", "warning")
  })

  it.each([
    ["positive", "Healthy", "bg-primary"],
    ["warning", "Queued", "bg-secondary"],
    ["negative", "Failed", "bg-destructive"],
    ["neutral", "Idle", "bg-muted"],
  ] as const)("applies the %s tone styles", (tone, label, expectedClass) => {
    render(<StatusBadge tone={tone}>{label}</StatusBadge>)

    expect(screen.getByText(label)).toHaveClass(expectedClass)
  })

  it("merges caller-provided classes", () => {
    render(
      <StatusBadge className="uppercase" tone="neutral">
        Idle
      </StatusBadge>,
    )

    expect(screen.getByText("Idle")).toHaveClass("uppercase")
  })
})
