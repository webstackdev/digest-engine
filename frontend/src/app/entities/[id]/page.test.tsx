import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Entity, Project } from "@/lib/types"

const {
  getProjectEntityAuthorityHistoryMock,
  getProjectEntitiesMock,
  getProjectEntityMentionsMock,
  getProjectEntityMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectEntityAuthorityHistoryMock: vi.fn(),
  getProjectEntitiesMock: vi.fn(),
  getProjectEntityMentionsMock: vi.fn(),
  getProjectEntityMock: vi.fn(),
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

vi.mock("@/components/elements/StatusBadge", () => ({
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
  getProjectEntityAuthorityHistory: getProjectEntityAuthorityHistoryMock,
  getProjectEntities: getProjectEntitiesMock,
  getProjectEntity: getProjectEntityMock,
  getProjectEntityMentions: getProjectEntityMentionsMock,
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
    linkedin_url: "",
    bluesky_handle: "openai.bsky.social",
    mastodon_handle: "",
    twitter_handle: "openai",
    mention_count: 2,
    latest_mentions: [],
    created_at: "2026-04-28T10:00:00Z",
    ...overrides,
  }
}

async function loadEntityDetailPageModule() {
  return import("./page")
}

async function renderEntityDetailPage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
  params: { id: string } = { id: "7" },
) {
  const { default: EntityDetailPage } = await loadEntityDetailPageModule()

  return render(
    await EntityDetailPage({
      params: Promise.resolve(params),
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("EntityDetailPage", () => {
  beforeEach(() => {
    const defaultProject = createProject()
    const defaultEntity = createEntity()

    getProjectsMock.mockReset()
    getProjectEntityMock.mockReset()
    getProjectEntityMentionsMock.mockReset()
    getProjectEntityAuthorityHistoryMock.mockReset()
    getProjectEntitiesMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectEntityMock.mockResolvedValue(defaultEntity)
    getProjectEntityMentionsMock.mockResolvedValue([])
    getProjectEntityAuthorityHistoryMock.mockResolvedValue([])
    getProjectEntitiesMock.mockResolvedValue([defaultEntity])
    selectProjectMock.mockImplementation((projects: Project[]) => {
      return projects[0] ?? null
    })
  })

  it("renders the no-project empty state and skips entity lookups", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderEntityDetailPage({}, { id: "7" })

    expect(selectProjectMock).toHaveBeenCalledWith([], {})
    expect(
      screen.getByText("No project is available for the configured API user."),
    ).toBeInTheDocument()
    expect(getProjectEntityMock).not.toHaveBeenCalled()
    expect(getProjectEntityMentionsMock).not.toHaveBeenCalled()
    expect(getProjectEntityAuthorityHistoryMock).not.toHaveBeenCalled()
  })

  it("renders entity metadata, identity links, and mention history", async () => {
    const selectedProject = createProject({ id: 3, name: "Data Signals" })
    const entity = createEntity({
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
    })
    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectEntityMock.mockResolvedValue(entity)
    getProjectEntityMentionsMock.mockResolvedValue([
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
      {
        id: 32,
        content_id: 23,
        content_title: "Platform teams discuss Anthropic",
        role: "mentioned",
        sentiment: "neutral",
        span: "Anthropic",
        confidence: 0.76,
        created_at: "2026-04-28T13:00:00Z",
      },
    ])
    getProjectEntityAuthorityHistoryMock.mockResolvedValue([
      {
        id: 51,
        entity: 11,
        project: 3,
        computed_at: "2026-04-28T14:00:00Z",
        mention_component: 0.8,
        feedback_component: 0.7,
        duplicate_component: 0.5,
        decayed_prior: 0.6,
        final_score: 0.91,
      },
      {
        id: 50,
        entity: 11,
        project: 3,
        computed_at: "2026-04-27T14:00:00Z",
        mention_component: 0.7,
        feedback_component: 0.6,
        duplicate_component: 0.4,
        decayed_prior: 0.5,
        final_score: 0.82,
      },
    ])
    getProjectEntitiesMock.mockResolvedValue([
      entity,
      createEntity({
        id: 12,
        project: 3,
        name: "OpenAI",
        mention_count: 1,
      }),
    ])

    await renderEntityDetailPage({ project: "3" }, { id: "11" })

    expect(getProjectEntityMock).toHaveBeenCalledWith(3, 11)
    expect(getProjectEntityMentionsMock).toHaveBeenCalledWith(3, 11)
    expect(getProjectEntityAuthorityHistoryMock).toHaveBeenCalledWith(3, 11)
    expect(screen.getByRole("heading", { name: "Anthropic" })).toBeInTheDocument()
    expect(screen.getByText("2 mentions")).toBeInTheDocument()
    expect(screen.getByText("Authority 91%")).toBeInTheDocument()
    expect(screen.getByText("Safety-focused AI company")).toBeInTheDocument()
    expect(screen.getByText("Current score and history")).toBeInTheDocument()
    expect(screen.getByText("Mention frequency")).toBeInTheDocument()
    expect(screen.getByText("Feedback")).toBeInTheDocument()
    expect(screen.getByText("Duplicate signal")).toBeInTheDocument()
    expect(screen.getByText("Carry-forward")).toBeInTheDocument()
    expect(screen.getByText("Final 91%")).toBeInTheDocument()
    expect(screen.getByText("Website")).toBeInTheDocument()
    expect(screen.getByText("Twitter anthropicai")).toBeInTheDocument()
    expect(
      screen.getByText("Anthropic ships a safety update"),
    ).toBeInTheDocument()
    expect(screen.getByText("94% confidence")).toBeInTheDocument()
    expect(screen.getByText("Back to entities")).toBeInTheDocument()
    expect(screen.getByText("OpenAI")).toBeInTheDocument()

    const badge = screen.getByTestId("status-badge")
    expect(badge).toHaveAttribute("data-tone", "neutral")
    expect(badge).toHaveTextContent("organization")
  })

  it("renders an empty mention state when no mentions exist", async () => {
    await renderEntityDetailPage({ project: "1" }, { id: "7" })

    expect(
      screen.getByText("No extracted mentions exist for this entity yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Authority history has not been recomputed for this entity yet."),
    ).toBeInTheDocument()
  })
})
