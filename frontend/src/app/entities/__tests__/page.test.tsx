import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Entity, Project } from "@/lib/types"

const { getProjectEntitiesMock, getProjectsMock, selectProjectMock } = vi.hoisted(
  () => ({
    getProjectEntitiesMock: vi.fn(),
    getProjectsMock: vi.fn(),
    selectProjectMock: vi.fn(),
  }),
)

vi.mock("@/components/app-shell", () => ({
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

vi.mock("@/components/status-badge", () => ({
  StatusBadge: ({
    children,
    tone,
  }: {
    children: ReactNode
    tone: string
  }) => (
    <span data-testid="status-badge" data-tone={tone}>
      {children}
    </span>
  ),
}))

vi.mock("@/lib/api", () => ({
  getProjectEntities: getProjectEntitiesMock,
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
    group: 10,
    topic_description: "AI news",
    content_retention_days: 30,
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  }
}

function createEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 7,
    project: 1,
    name: "OpenAI",
    type: "vendor",
    description: "LLM provider",
    authority_score: 0.82,
    website_url: "https://openai.com",
    github_url: "https://github.com/openai",
    linkedin_url: "https://linkedin.com/company/openai",
    bluesky_handle: "openai.bsky.social",
    mastodon_handle: "@openai@mastodon.social",
    twitter_handle: "openai",
    created_at: "2026-04-28T10:00:00Z",
    ...overrides,
  }
}

async function loadEntitiesPageModule() {
  return import("../page")
}

async function renderEntitiesPage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
) {
  const { default: EntitiesPage } = await loadEntitiesPageModule()

  return render(
    await EntitiesPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("EntitiesPage", () => {
  beforeEach(() => {
    const defaultProject = createProject()

    getProjectsMock.mockReset()
    getProjectEntitiesMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectEntitiesMock.mockResolvedValue([])
    selectProjectMock.mockImplementation((projects: Project[]) => {
      return projects[0] ?? null
    })
  })

  it("renders the no-project empty state and skips entity lookups", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderEntitiesPage({})

    expect(selectProjectMock).toHaveBeenCalledWith([], {})
    expect(
      screen.getByText("No project found for this API user."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Create a project first in Django admin."),
    ).toBeInTheDocument()
    expect(getProjectEntitiesMock).not.toHaveBeenCalled()
  })

  it("renders flash messages and the empty entity state", async () => {
    await renderEntitiesPage({
      error: "Could not save entity",
      message: "Entity saved",
      project: "1",
    })

    expect(selectProjectMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      {
        error: "Could not save entity",
        message: "Entity saved",
        project: "1",
      },
    )
    expect(screen.getByText("Could not save entity")).toBeInTheDocument()
    expect(screen.getByText("Entity saved")).toBeInTheDocument()
    expect(
      screen.getByText("No entities exist for this project yet."),
    ).toBeInTheDocument()
    expect(getProjectEntitiesMock).toHaveBeenCalledWith(1)
  })

  it("renders entity cards, badge tone, and edit form defaults", async () => {
    const selectedProject = createProject({ id: 3, name: "Data Signals" })
    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectEntitiesMock.mockResolvedValue([
      createEntity({
        id: 11,
        project: 3,
        name: "Anthropic",
        type: "organization",
        authority_score: 0.91,
        description: "Safety-focused AI company",
        website_url: "https://anthropic.com",
        github_url: "",
        linkedin_url: "",
        bluesky_handle: "",
        mastodon_handle: "",
        twitter_handle: "anthropicai",
      }),
    ])

    await renderEntitiesPage({ project: "3" })

    expect(selectProjectMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 3 })],
      { project: "3" },
    )
    expect(screen.getByRole("heading", { name: "Anthropic" })).toBeInTheDocument()
    expect(screen.getByText("Authority 0.91")).toBeInTheDocument()

    const badge = screen.getByTestId("status-badge")
    expect(badge).toHaveAttribute("data-tone", "neutral")
    expect(badge).toHaveTextContent("organization")

    expect(
      screen.getByDisplayValue("Safety-focused AI company"),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("https://anthropic.com")).toBeInTheDocument()
    expect(screen.getByDisplayValue("anthropicai")).toBeInTheDocument()
    expect(screen.getAllByDisplayValue("/entities?project=3")).toHaveLength(3)
  })
})
