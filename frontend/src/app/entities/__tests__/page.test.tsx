import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Entity, EntityCandidate, Project } from "@/lib/types"

const {
  getProjectEntitiesMock,
  getProjectEntityCandidatesMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectEntitiesMock: vi.fn(),
  getProjectEntityCandidatesMock: vi.fn(),
  getProjectsMock: vi.fn(),
  selectProjectMock: vi.fn(),
}))

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
  getProjectEntityCandidates: getProjectEntityCandidatesMock,
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
    user_role: "admin",
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
    mention_count: 0,
    latest_mentions: [],
    created_at: "2026-04-28T10:00:00Z",
    ...overrides,
  }
}

function createEntityCandidate(
  overrides: Partial<EntityCandidate> = {},
): EntityCandidate {
  return {
    id: 14,
    project: 1,
    name: "River Labs",
    suggested_type: "vendor",
    first_seen_in: 21,
    first_seen_title: "River Labs launches hosted platform",
    occurrence_count: 2,
    status: "pending",
    merged_into: null,
    merged_into_name: "",
    created_at: "2026-04-28T10:00:00Z",
    updated_at: "2026-04-28T11:00:00Z",
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
    getProjectEntityCandidatesMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectEntitiesMock.mockResolvedValue([])
    getProjectEntityCandidatesMock.mockResolvedValue([])
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
    expect(getProjectEntityCandidatesMock).not.toHaveBeenCalled()
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
    expect(
      screen.getByText("No pending entity candidates right now."),
    ).toBeInTheDocument()
    expect(getProjectEntitiesMock).toHaveBeenCalledWith(1)
    expect(getProjectEntityCandidatesMock).toHaveBeenCalledWith(1)
  })

  it("renders entity cards, mention summaries, and the candidate queue", async () => {
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
        mention_count: 2,
        latest_mentions: [
          {
            id: 31,
            content_id: 22,
            content_title: "Anthropic ships a safety update",
            role: "subject",
            sentiment: "positive",
            span: "Anthropic",
            confidence: 0.94,
            created_at: "2026-04-28T12:00:00Z",
          },
        ],
      }),
    ])
    getProjectEntityCandidatesMock.mockResolvedValue([
      createEntityCandidate({
        project: 3,
        occurrence_count: 3,
      }),
    ])

    await renderEntitiesPage({ project: "3" })

    expect(selectProjectMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 3 })],
      { project: "3" },
    )
    expect(screen.getByRole("heading", { name: "Anthropic" })).toBeInTheDocument()
    expect(screen.getByText("Authority 0.91")).toBeInTheDocument()
    expect(screen.getByText("2 mentions")).toBeInTheDocument()
    expect(
      screen.getByText("Anthropic ships a safety update"),
    ).toBeInTheDocument()
    expect(screen.getByText("94% confidence")).toBeInTheDocument()
    expect(screen.getByText("Pending entity candidates")).toBeInTheDocument()
    expect(screen.getByText("River Labs")).toBeInTheDocument()
    expect(screen.getByText("3 occurrences")).toBeInTheDocument()
    expect(
      screen.getByText("First seen in River Labs launches hosted platform"),
    ).toBeInTheDocument()

    const badges = screen.getAllByTestId("status-badge")
    expect(badges[0]).toHaveAttribute("data-tone", "warning")
    expect(badges[0]).toHaveTextContent("pending")
    expect(badges[1]).toHaveAttribute("data-tone", "neutral")
    expect(badges[1]).toHaveTextContent("organization")

    expect(
      screen.getByDisplayValue("Safety-focused AI company"),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("https://anthropic.com")).toBeInTheDocument()
    expect(screen.getByDisplayValue("anthropicai")).toBeInTheDocument()
    expect(screen.getAllByDisplayValue("/entities?project=3")).toHaveLength(6)
  })
})
