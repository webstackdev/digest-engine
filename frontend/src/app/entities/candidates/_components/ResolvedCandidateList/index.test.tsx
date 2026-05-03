import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { createEntityCandidate } from "@/lib/storybook-fixtures"

import { ResolvedCandidateList } from "."

vi.mock("@/components/elements/StatusBadge", () => ({
  StatusBadge: ({ children, tone }: { children: ReactNode; tone: string }) => (
    <span data-testid="status-badge" data-tone={tone}>
      {children}
    </span>
  ),
}))

describe("ResolvedCandidateList", () => {
  it("renders the empty resolved state", () => {
    render(<ResolvedCandidateList resolvedCandidates={[]} />)

    expect(
      screen.getByText("No auto-promotion or review history is available for this project yet.")
    ).toBeInTheDocument()
  })

  it("renders resolved candidate log rows", () => {
    render(
      <ResolvedCandidateList
        resolvedCandidates={[
          createEntityCandidate({
            id: 18,
            status: "accepted",
            updated_at: "2026-05-02T12:00:00Z",
          }),
        ]}
      />
    )

    expect(screen.getByText(/Resolved May 2, 2026/)).toBeInTheDocument()
    expect(screen.getByText("2 sources")).toBeInTheDocument()
    expect(screen.getByTestId("status-badge")).toHaveTextContent("accepted")
  })
})