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
    title,
  }: {
    children: ReactNode
    description: string
    title: string
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
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

async function loadNewProjectPageModule() {
  return import("./page")
}

async function renderNewProjectPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const { default: NewProjectPage } = await loadNewProjectPageModule()

  return render(
    await NewProjectPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("NewProjectPage", () => {
  beforeEach(() => {
    const projects = [createProject()]

    getProjectsMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue(projects)
    selectProjectMock.mockReturnValue(projects[0])
  })

  it("renders the project creation form", async () => {
    await renderNewProjectPage()

    expect(
      screen.getByRole("heading", { level: 1, name: "Create project" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "New project" })).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByLabelText("Topic description")).toBeInTheDocument()
    expect(screen.getByLabelText("Content retention days")).toHaveValue(365)
    expect(getProjectsMock).toHaveBeenCalledTimes(1)
  })

  it("passes search params to selectProject and shows an error flash", async () => {
    const projects = [createProject({ id: 2, name: "Data Signals" })]
    getProjectsMock.mockResolvedValue(projects)
    selectProjectMock.mockReturnValue(projects[0])

    await renderNewProjectPage({
      project: "2",
      error: "A project with that name already exists.",
    })

    expect(selectProjectMock).toHaveBeenCalledWith(projects, {
      project: "2",
      error: "A project with that name already exists.",
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Could not create project")).toBeInTheDocument()
  })

  it("shows a success flash when present", async () => {
    await renderNewProjectPage({
      message: "Project created. You are now the first project admin.",
    })

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Project updated")).toBeInTheDocument()
    expect(
      screen.getByText("Project created. You are now the first project admin."),
    ).toBeInTheDocument()
  })
})
