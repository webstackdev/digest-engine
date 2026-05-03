import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createEntity, createEntityCandidate } from "@/lib/storybook-fixtures"

import { EntityCandidatesCard } from "."

describe("EntityCandidatesCard", () => {
  it("renders the empty queue state", () => {
    render(<EntityCandidatesCard entities={[]} entityCandidates={[]} projectId={5} />)

    expect(screen.getByText("Pending entity candidates")).toBeInTheDocument()
    expect(screen.getByText("No pending entity candidates right now.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open clustered queue" })).toHaveAttribute(
      "href",
      "/entities/candidates?project=5"
    )
  })

  it("renders candidate actions and merge targets", () => {
    render(
      <EntityCandidatesCard
        entities={[createEntity({ id: 9, name: "Anthropic" })]}
        entityCandidates={[createEntityCandidate({ occurrence_count: 3 })]}
        projectId={3}
      />
    )

    expect(screen.getByText("River Labs")).toBeInTheDocument()
    expect(screen.getByText("3 occurrences")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Merge" })).toBeInTheDocument()
    expect(screen.getByLabelText("Merge into existing entity")).toBeInTheDocument()
    expect(screen.getByText("pending")).toBeInTheDocument()
  })
})
