import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createProject, createSourceConfig } from "@/lib/storybook-fixtures"

import { DashboardSidebar } from "."

describe("DashboardSidebar", () => {
  it("renders project context and source counts", () => {
    render(
      <DashboardSidebar
        pendingReviewCount={4}
        selectedProject={createProject()}
        sourceConfigs={[createSourceConfig(), createSourceConfig({ id: 3, is_active: false })]}
      />,
    )

    expect(screen.getByText("Project focus")).toBeInTheDocument()
    expect(screen.getByText("AI Weekly")).toBeInTheDocument()
    expect(screen.getByText("Active sources")).toBeInTheDocument()
    expect(screen.getByText("Editorial queue")).toBeInTheDocument()
  })
})
