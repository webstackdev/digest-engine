import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Project } from "@/lib/types"

const { getProjectsMock, selectProjectMock } = vi.hoisted(() => ({
  getProjectsMock: vi.fn(),
  selectProjectMock: vi.fn(),
}))

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    children,
    description,
    selectedProjectId,
    title,
  }: {
    children: ReactNode
    description: string
    selectedProjectId: number | null
    title: string
  }) => (
    <div data-selected-project-id={selectedProjectId ?? "null"} data-testid="app-shell">
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}))

vi.mock("@/app/profile/_components/ProfileSettingsPanel", () => ({
  ProfileSettingsPanel: () => <div data-testid="profile-settings-panel" />,
}))

vi.mock("@/lib/api", () => ({
  getProjects: getProjectsMock,
}))

vi.mock("@/lib/view-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/view-helpers")>(
    "@/lib/view-helpers",
  )

  return {
    ...actual,
    selectProject: selectProjectMock,
  }
})

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "AI Weekly",
    topic_description: "AI news",
    content_retention_days: 30,
    user_role: "admin",
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  }
}

async function renderProfilePage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const { default: ProfilePage } = await import("./page")

  return render(
    await ProfilePage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("ProfilePage", () => {
  beforeEach(() => {
    getProjectsMock.mockReset()
    selectProjectMock.mockReset()

    const project = createProject()
    getProjectsMock.mockResolvedValue([project])
    selectProjectMock.mockReturnValue(project)
  })

  it("renders the app shell and profile settings panel", async () => {
    await renderProfilePage({ project: "1" })

    expect(screen.getByText("Profile")).toBeInTheDocument()
    expect(screen.getByTestId("profile-settings-panel")).toBeInTheDocument()
    expect(screen.getByTestId("app-shell")).toHaveAttribute(
      "data-selected-project-id",
      "1",
    )
  })

  it("falls back to a null selected project when no matching project is visible", async () => {
    selectProjectMock.mockReturnValueOnce(null)

    await renderProfilePage({})

    expect(screen.getByTestId("app-shell")).toHaveAttribute(
      "data-selected-project-id",
      "null",
    )
  })
})
