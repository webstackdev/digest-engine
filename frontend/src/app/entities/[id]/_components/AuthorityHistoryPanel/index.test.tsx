import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  createEntity,
  createEntityAuthoritySnapshot,
  createProjectConfig,
} from "@/lib/storybook-fixtures"

import { AuthorityHistoryPanel } from "."

vi.mock("@/app/entities/[id]/_components/AuthorityWeightControls", () => ({
  AuthorityWeightControls: ({ projectId }: { projectId: number }) => (
    <div data-testid="authority-weight-controls">Authority weight controls for project {projectId}</div>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

describe("AuthorityHistoryPanel", () => {
  it("renders the authority score, component mix, and admin controls", () => {
    const latest = createEntityAuthoritySnapshot()
    const previous = createEntityAuthoritySnapshot({
      id: 50,
      computed_at: "2026-04-27T14:00:00Z",
      final_score: 0.82,
    })

    render(
      <AuthorityHistoryPanel
        authorityComponents={latest}
        authorityHistory={[latest, previous]}
        entity={createEntity({ authority_score: 0.91 })}
        projectConfig={createProjectConfig()}
        projectId={3}
        redirectTo="/entities/7?project=3"
        userRole="admin"
      />
    )

    expect(screen.getByText("Current score and history")).toBeInTheDocument()
    expect(screen.getByText("Current component mix")).toBeInTheDocument()
    expect(screen.getByLabelText("Authority component mix")).toBeInTheDocument()
    expect(screen.getByText("Weights at compute")).toBeInTheDocument()
    expect(screen.getByText("engagement 15%")).toBeInTheDocument()
    expect(screen.getByText("Final 91%")).toBeInTheDocument()
    expect(screen.getByTestId("authority-weight-controls")).toHaveTextContent(
      "Authority weight controls for project 3"
    )
  })

  it("renders empty authority fallbacks and hides admin controls for non-admins", () => {
    render(
      <AuthorityHistoryPanel
        authorityComponents={null}
        authorityHistory={[]}
        entity={createEntity({ authority_score: 0.82 })}
        projectConfig={null}
        projectId={1}
        redirectTo="/entities/7?project=1"
        userRole="member"
      />
    )

    expect(screen.getByText("Authority history has not been recomputed for this entity yet.")).toBeInTheDocument()
    expect(screen.getByText("More recomputations will draw the trend line here.")).toBeInTheDocument()
    expect(screen.queryByTestId("authority-weight-controls")).not.toBeInTheDocument()
  })
})
