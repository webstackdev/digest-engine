import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AppShell } from "@/components/layout/AppShell"
import type { Project } from "@/lib/types"

vi.mock("@/components/layout/AppShell/_components/AppShellHeader", () => ({
  AppShellHeader: ({ description, title }: { description: string; title: string }) => (
    <div data-testid="app-shell-header">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}))

vi.mock("@/components/layout/AppShell/_components/AppShellSidebar", () => ({
  AppShellSidebar: ({
    canManageMembers,
    projectQuery,
    projects,
    selectedProjectId,
  }: {
    canManageMembers: boolean
    projectQuery: string
    projects: Project[]
    selectedProjectId: number | null
  }) => (
    <div
      data-can-manage-members={canManageMembers ? "true" : "false"}
      data-project-query={projectQuery}
      data-projects={projects.length}
      data-selected-project-id={selectedProjectId ?? "none"}
      data-testid="app-shell-sidebar"
    />
  ),
}))

const projects: Project[] = [
  {
    id: 1,
    name: "AI Weekly",
    topic_description: "Applied AI",
    content_retention_days: 30,
    user_role: "admin",
    created_at: "2026-04-27T00:00:00Z",
  },
  {
    id: 2,
    name: "Platform Weekly",
    topic_description: "Platform engineering",
    content_retention_days: 30,
    user_role: "member",
    created_at: "2026-04-27T00:00:00Z",
  },
]

describe("AppShell", () => {
  it("renders the extracted shell regions and child content", () => {
    render(
      <AppShell
        title="Dashboard"
        description="A test description"
        projects={projects}
        selectedProjectId={1}
      >
        <div>Child content</div>
      </AppShell>,
    )

    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-project-query",
      "?project=1",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-can-manage-members",
      "true",
    )
    expect(screen.getByTestId("app-shell-header")).toHaveTextContent("Dashboard")
    expect(screen.getByTestId("app-shell-header")).toHaveTextContent("A test description")
    expect(screen.getByText("Child content")).toBeInTheDocument()
  })

  it("passes member access and empty project query state into the sidebar", () => {
    render(
      <AppShell
        title="Dashboard"
        description="A test description"
        projects={projects}
        selectedProjectId={2}
      >
        <div>Child content</div>
      </AppShell>,
    )

    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-project-query",
      "?project=2",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-can-manage-members",
      "false",
    )
  })
})
