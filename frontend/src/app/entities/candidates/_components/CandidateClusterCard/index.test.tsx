import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { createEntity, createEntityCandidate } from "@/lib/storybook-fixtures"

import { groupCandidateClusters } from "../shared"
import { CandidateClusterCard } from "."

vi.mock("@/components/elements/StatusBadge", () => ({
  StatusBadge: ({ children, tone }: { children: ReactNode; tone: string }) => (
    <span data-testid="status-badge" data-tone={tone}>
      {children}
    </span>
  ),
}))

describe("CandidateClusterCard", () => {
  it("renders cluster members, pills, and bulk actions", () => {
    const cluster = groupCandidateClusters([
      createEntityCandidate(),
      createEntityCandidate({
        id: 15,
        name: "River Labs AI",
        occurrence_count: 4,
        evidence_count: 4,
      }),
    ])[0]

    render(
      <CandidateClusterCard
        cluster={cluster}
        entities={[createEntity({ id: 9, name: "OpenAI" })]}
        selectedProjectId={3}
      />
    )

    expect(screen.getByText("Cluster of 2 candidates")).toBeInTheDocument()
  expect(screen.getByText("6 total occurrences")).toBeInTheDocument()
    expect(screen.getByText("River Labs")).toBeInTheDocument()
    expect(screen.getByText("River Labs AI")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept cluster" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reject cluster" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Merge cluster" })).toBeInTheDocument()
    expect(screen.getByLabelText("Merge cluster into entity")).toBeInTheDocument()
    expect(screen.getAllByTestId("status-badge")).toHaveLength(2)
  })
})