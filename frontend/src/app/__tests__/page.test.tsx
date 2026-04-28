import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  Content,
  Entity,
  Project,
  ReviewQueueItem,
  SourceConfig,
  UserFeedback,
} from "@/lib/types"

const {
  buildDashboardViewMock,
  getProjectContentsMock,
  getProjectEntitiesMock,
  getProjectFeedbackMock,
  getProjectsMock,
  getProjectReviewQueueMock,
  getProjectSourceConfigsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  buildDashboardViewMock: vi.fn(),
  getProjectContentsMock: vi.fn(),
  getProjectEntitiesMock: vi.fn(),
  getProjectFeedbackMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getProjectReviewQueueMock: vi.fn(),
  getProjectSourceConfigsMock: vi.fn(),
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
  getProjectContents: getProjectContentsMock,
  getProjectEntities: getProjectEntitiesMock,
  getProjectFeedback: getProjectFeedbackMock,
  getProjects: getProjectsMock,
  getProjectReviewQueue: getProjectReviewQueueMock,
  getProjectSourceConfigs: getProjectSourceConfigsMock,
}))

vi.mock("@/lib/dashboard-view", () => ({
  buildDashboardView: buildDashboardViewMock,
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

function createContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 41,
    project: 1,
    url: "https://example.com/post",
    title: "Useful AI briefing",
    author: "Ada",
    entity: null,
    source_plugin: "rss",
    content_type: "article",
    published_date: "2026-04-28T09:00:00Z",
    ingested_at: "2026-04-28T10:00:00Z",
    content_text: "A long article body for the dashboard preview.",
    relevance_score: 0.84,
    embedding_id: "embed-1",
    is_reference: false,
    is_active: true,
    ...overrides,
  }
}

function createReviewQueueItem(
  overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
  return {
    id: 7,
    project: 1,
    content: 41,
    reason: "borderline_relevance",
    confidence: 0.61,
    created_at: "2026-04-28T12:00:00Z",
    resolved: false,
    resolution: "",
    ...overrides,
  }
}

function createEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 3,
    project: 1,
    name: "OpenAI",
    type: "vendor",
    description: "LLM vendor",
    authority_score: 0.91,
    website_url: "https://openai.com",
    github_url: "",
    linkedin_url: "",
    bluesky_handle: "",
    mastodon_handle: "",
    twitter_handle: "openai",
    created_at: "2026-04-28T09:30:00Z",
    ...overrides,
  }
}

function createSourceConfig(
  overrides: Partial<SourceConfig> = {},
): SourceConfig {
  return {
    id: 2,
    project: 1,
    plugin_name: "rss",
    config: { feed_url: "https://example.com/feed.xml" },
    is_active: true,
    last_fetched_at: "2026-04-28T07:00:00Z",
    ...overrides,
  }
}

function createFeedback(overrides: Partial<UserFeedback> = {}): UserFeedback {
  return {
    id: 9,
    content: 41,
    project: 1,
    user: 2,
    feedback_type: "upvote",
    created_at: "2026-04-28T12:30:00Z",
    ...overrides,
  }
}

function createDashboardView(overrides: Record<string, unknown> = {}) {
  return {
    contentMap: new Map<number, Content>(),
    contentTypeFilter: "",
    contentTypes: [],
    daysFilter: 30,
    filteredContents: [],
    negativeFeedback: 0,
    pendingReviewItems: [],
    positiveFeedback: 0,
    sourceFilter: "",
    sources: [],
    view: "content",
    ...overrides,
  }
}

async function loadHomePageModule() {
  return import("../page")
}

async function renderHomePage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
) {
  const { default: HomePage } = await loadHomePageModule()

  return render(
    await HomePage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("HomePage", () => {
  beforeEach(() => {
    const defaultProject = createProject()
    const contents = [createContent()]
    const reviewQueue = [createReviewQueueItem()]
    const entities = [createEntity()]
    const sourceConfigs = [createSourceConfig()]
    const feedback = [createFeedback()]

    getProjectsMock.mockReset()
    getProjectContentsMock.mockReset()
    getProjectReviewQueueMock.mockReset()
    getProjectEntitiesMock.mockReset()
    getProjectSourceConfigsMock.mockReset()
    getProjectFeedbackMock.mockReset()
    buildDashboardViewMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectContentsMock.mockResolvedValue(contents)
    getProjectReviewQueueMock.mockResolvedValue(reviewQueue)
    getProjectEntitiesMock.mockResolvedValue(entities)
    getProjectSourceConfigsMock.mockResolvedValue(sourceConfigs)
    getProjectFeedbackMock.mockResolvedValue(feedback)
    selectProjectMock.mockImplementation((projects: Project[]) => {
      return projects[0] ?? null
    })
    buildDashboardViewMock.mockReturnValue(
      createDashboardView({
        contentMap: new Map([[41, contents[0]]]),
        contentTypes: ["article"],
        filteredContents: contents,
        pendingReviewItems: reviewQueue,
        positiveFeedback: 1,
        sources: ["rss"],
      }),
    )
  })

  it("renders the no-project empty state and skips project-scoped requests", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderHomePage({})

    expect(selectProjectMock).toHaveBeenCalledWith([], {})
    expect(
      screen.getByText(
        "Create a project in Django admin first, then come back here to review ingested content.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No projects are available for the configured API user."),
    ).toBeInTheDocument()
    expect(getProjectContentsMock).not.toHaveBeenCalled()
    expect(buildDashboardViewMock).not.toHaveBeenCalled()
  })

  it("renders the content view with summaries, flash messages, and content cards", async () => {
    const content = createContent({
      title: "Useful AI briefing",
      is_reference: true,
      is_active: false,
      relevance_score: 0.84,
    })
    const reviewItem = createReviewQueueItem({ content: content.id })
    const feedback = [
      createFeedback({ feedback_type: "upvote", content: content.id }),
      createFeedback({
        id: 10,
        feedback_type: "downvote",
        content: content.id,
      }),
    ]
    const sourceConfigs = [
      createSourceConfig({ is_active: true }),
      createSourceConfig({ id: 3, plugin_name: "reddit", is_active: false }),
    ]

    getProjectContentsMock.mockResolvedValue([content])
    getProjectReviewQueueMock.mockResolvedValue([reviewItem])
    getProjectSourceConfigsMock.mockResolvedValue(sourceConfigs)
    getProjectFeedbackMock.mockResolvedValue(feedback)
    buildDashboardViewMock.mockReturnValue(
      createDashboardView({
        contentMap: new Map([[content.id, content]]),
        contentTypeFilter: "article",
        contentTypes: ["article"],
        filteredContents: [content],
        negativeFeedback: 1,
        pendingReviewItems: [reviewItem],
        positiveFeedback: 1,
        sourceFilter: "rss",
        sources: ["reddit", "rss"],
        view: "content",
      }),
    )

    await renderHomePage({
      contentType: "article",
      error: "Filter failed",
      message: "Filters applied",
      project: "1",
      source: "rss",
      view: "content",
    })

    expect(buildDashboardViewMock).toHaveBeenCalledWith({
      contents: [content],
      feedback,
      reviewQueue: [reviewItem],
      searchParams: {
        contentType: "article",
        error: "Filter failed",
        message: "Filters applied",
        project: "1",
        source: "rss",
        view: "content",
      },
    })
    expect(screen.getByText("Filter failed")).toBeInTheDocument()
    expect(screen.getByText("Filters applied")).toBeInTheDocument()
    expect(screen.getByText("Useful AI briefing")).toBeInTheDocument()
    expect(screen.getByText("1/1")).toBeInTheDocument()
    expect(
      screen.getAllByText("1", { selector: "p.mt-1.text-3xl.font-bold" }),
    ).toHaveLength(5)
    expect(screen.getByText("reference")).toBeInTheDocument()
    expect(screen.getByText("archived")).toBeInTheDocument()

    const badges = screen.getAllByTestId("status-badge")
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveAttribute("data-tone", "positive")
    expect(badges[0]).toHaveTextContent("Relevance 0.84")
  })

  it("renders the empty content state when no content matches the current filters", async () => {
    buildDashboardViewMock.mockReturnValue(
      createDashboardView({
        filteredContents: [],
        pendingReviewItems: [],
        view: "content",
      }),
    )

    await renderHomePage({ project: "1" })

    expect(
      screen.getByText("No content matched the current filters."),
    ).toBeInTheDocument()
  })

  it("renders the review view empty state when there are no unresolved items", async () => {
    buildDashboardViewMock.mockReturnValue(
      createDashboardView({
        pendingReviewItems: [],
        view: "review",
      }),
    )

    await renderHomePage({ project: "1", view: "review" })

    expect(
      screen.getByText("No unresolved review items for this project right now."),
    ).toBeInTheDocument()
  })

  it("renders the review table with fallback content labels when content metadata is missing", async () => {
    const reviewItem = createReviewQueueItem({ id: 14, content: 99 })
    buildDashboardViewMock.mockReturnValue(
      createDashboardView({
        contentMap: new Map(),
        pendingReviewItems: [reviewItem],
        view: "review",
      }),
    )

    await renderHomePage({ project: "1", view: "review" })

    expect(screen.getByText("Content #99", { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText("unknown source")).toBeInTheDocument()
    expect(screen.getByText("unclassified")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument()
  })
})