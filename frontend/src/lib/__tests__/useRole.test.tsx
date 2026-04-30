import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { Project, ProjectRole } from "@/lib/types"
import { PROJECTS_QUERY_KEY, useRole } from "@/lib/useRole"

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "AI Weekly",
    group: 10,
    topic_description: "AI news",
    content_retention_days: 30,
    intake_enabled: false,
    user_role: null,
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  }
}

function RoleInspector({ projectId }: { projectId: number | null }) {
  const role = useRole(projectId)

  return <span data-testid="role">{role ?? "null"}</span>
}

function renderWithProjects(
  projects: Project[],
  projectId: number | null,
) {
  const queryClient = new QueryClient()
  queryClient.setQueryData(PROJECTS_QUERY_KEY, projects)

  render(
    <QueryClientProvider client={queryClient}>
      <RoleInspector projectId={projectId} />
    </QueryClientProvider>,
  )
}

describe("useRole", () => {
  it("returns null when the projects query is not cached", () => {
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <RoleInspector projectId={1} />
      </QueryClientProvider>,
    )

    expect(screen.getByTestId("role")).toHaveTextContent("null")
  })

  it.each<[ProjectRole]>([["admin"], ["member"], ["reader"]])(
    "returns the cached %s role for the selected project",
    (role) => {
      renderWithProjects([createProject({ id: 4, user_role: role })], 4)

      expect(screen.getByTestId("role")).toHaveTextContent(role)
    },
  )

  it("returns null when the selected project is missing from the cache", () => {
    renderWithProjects([createProject({ id: 4, user_role: "admin" })], 99)

    expect(screen.getByTestId("role")).toHaveTextContent("null")
  })
})