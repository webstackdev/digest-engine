import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Entity, Project, ProjectConfig } from "@/lib/types"

const {
  getProjectEntityAuthorityComponentsMock,
  getProjectEntityAuthorityHistoryMock,
  getProjectConfigMock,
  getProjectEntitiesMock,
  getProjectEntityMentionsMock,
  getProjectEntityMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectEntityAuthorityComponentsMock: vi.fn(),
  getProjectEntityAuthorityHistoryMock: vi.fn(),
  getProjectConfigMock: vi.fn(),
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

vi.mock("@/app/entities/[id]/_components/AuthorityWeightControls", () => ({
  AuthorityWeightControls: ({ projectId }: { projectId: number }) => (
    <div data-testid="authority-weight-controls">
      Authority weight controls for project {projectId}
    </div>
  ),
}))

vi.mock("@/lib/api", () => ({
  getProjectConfig: getProjectConfigMock,
  getProjectEntityAuthorityComponents: getProjectEntityAuthorityComponentsMock,
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

function createProjectConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    id: 5,
    project: 1,
    draft_schedule_cron: "",
    authority_weight_mention: 0.2,
    authority_weight_engagement: 0.15,
    authority_weight_recency: 0.15,
    authority_weight_source_quality: 0.15,
    authority_weight_cross_newsletter: 0.2,
    authority_weight_feedback: 0.1,
    authority_weight_duplicate: 0.05,
    upvote_authority_weight: 0.05,
    downvote_authority_weight: -0.05,
    authority_decay_rate: 0.9,
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
    getProjectEntityAuthorityComponentsMock.mockReset()
    getProjectEntityAuthorityHistoryMock.mockReset()
    getProjectConfigMock.mockReset()
    getProjectEntitiesMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectEntityMock.mockResolvedValue(defaultEntity)
    getProjectEntityMentionsMock.mockResolvedValue([])
    getProjectEntityAuthorityComponentsMock.mockRejectedValue(
      new Error("No authority components yet"),
    )
    getProjectEntityAuthorityHistoryMock.mockResolvedValue([])
    getProjectConfigMock.mockResolvedValue(createProjectConfig())
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
    expect(getProjectEntityAuthorityComponentsMock).not.toHaveBeenCalled()
    expect(getProjectEntityAuthorityHistoryMock).not.toHaveBeenCalled()
    expect(getProjectConfigMock).not.toHaveBeenCalled()
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
    getProjectEntityAuthorityComponentsMock.mockResolvedValue({
      id: 51,
      entity: 11,
      project: 3,
      computed_at: "2026-04-28T14:00:00Z",
      mention_component: 0.8,
      engagement_component: 0.65,
      recency_component: 0.7,
      source_quality_component: 0.6,
      cross_newsletter_component: 0.55,
      feedback_component: 0.7,
      duplicate_component: 0.6,
      decayed_prior: 0.53,
      weights_at_compute: {
        mention: 0.2,
        engagement: 0.15,
        recency: 0.15,
        source_quality: 0.15,
        cross_newsletter: 0.2,
        feedback: 0.1,
        duplicate: 0.05,
      },
      final_score: 0.91,
    })
    getProjectEntityAuthorityHistoryMock.mockResolvedValue([
      {
        id: 51,
        entity: 11,
        project: 3,
        computed_at: "2026-04-28T14:00:00Z",
        mention_component: 0.8,
        engagement_component: 0.65,
        recency_component: 0.7,
        source_quality_component: 0.6,
        cross_newsletter_component: 0.55,
        feedback_component: 0.7,
        duplicate_component: 0.5,
        decayed_prior: 0.6,
        weights_at_compute: { mention: 0.2 },
        final_score: 0.91,
      },
      {
        id: 50,
        entity: 11,
        project: 3,
        computed_at: "2026-04-27T14:00:00Z",
        mention_component: 0.7,
        engagement_component: 0.55,
        recency_component: 0.6,
        source_quality_component: 0.5,
        cross_newsletter_component: 0.45,
        feedback_component: 0.6,
        duplicate_component: 0.4,
        decayed_prior: 0.5,
        weights_at_compute: { mention: 0.2 },
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
    expect(getProjectEntityAuthorityComponentsMock).toHaveBeenCalledWith(3, 11)
    expect(getProjectEntityAuthorityHistoryMock).toHaveBeenCalledWith(3, 11)
    expect(getProjectConfigMock).toHaveBeenCalledWith(3)
    expect(screen.getByRole("heading", { name: "Anthropic" })).toBeInTheDocument()
    expect(screen.getByText("2 mentions")).toBeInTheDocument()
    expect(screen.getByText("Authority 91%")).toBeInTheDocument()
    expect(screen.getByText("Safety-focused AI company")).toBeInTheDocument()
    expect(screen.getByText("Current score and history")).toBeInTheDocument()
    expect(screen.getByText("Current component mix")).toBeInTheDocument()
    expect(screen.getAllByText("Mention frequency").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Engagement").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Recency").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Source quality").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Cross-newsletter").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Feedback").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Duplicate signal").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Carry-forward").length).toBeGreaterThan(0)
    expect(screen.getByText("Weights at compute")).toBeInTheDocument()
    expect(screen.getByText("engagement 15%")).toBeInTheDocument()
    expect(screen.getByText("Final 91%")).toBeInTheDocument()
    expect(screen.getByText("Website")).toBeInTheDocument()
    expect(screen.getByText("Twitter anthropicai")).toBeInTheDocument()
    expect(
      screen.getByText("Anthropic ships a safety update"),
    ).toBeInTheDocument()
    expect(screen.getByText("94% confidence")).toBeInTheDocument()
    expect(screen.getByText("Back to entities")).toBeInTheDocument()
    expect(screen.getByText("OpenAI")).toBeInTheDocument()
    expect(screen.getByLabelText("Authority component mix")).toBeInTheDocument()
    expect(screen.getByTestId("authority-weight-controls")).toHaveTextContent(
      "Authority weight controls for project 3",
    )

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

  it("skips authority weight controls for non-admin viewers", async () => {
    const memberProject = createProject({ id: 2, user_role: "member" })
    getProjectsMock.mockResolvedValue([memberProject])
    selectProjectMock.mockReturnValue(memberProject)

    await renderEntityDetailPage({ project: "2" }, { id: "7" })

    expect(getProjectConfigMock).not.toHaveBeenCalled()
    expect(screen.queryByTestId("authority-weight-controls")).not.toBeInTheDocument()
  })
})
