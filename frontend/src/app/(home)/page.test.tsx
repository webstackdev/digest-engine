import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  Content,
  Entity,
  Project,
  ReviewQueueItem,
  SourceConfig,
  TopicCluster,
  TopicClusterDetail,
  UserFeedback,
} from "@/lib/types"

const {
  buildDashboardViewMock,
  getProjectContentsMock,
  getProjectEntitiesMock,
  getProjectFeedbackMock,
  getProjectsMock,
  homePageContentMock,
  getProjectReviewQueueMock,
  getProjectSourceConfigsMock,
  getProjectTopicClusterMock,
  getProjectTopicClustersMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  buildDashboardViewMock: vi.fn(),
  getProjectContentsMock: vi.fn(),
  getProjectEntitiesMock: vi.fn(),
  getProjectFeedbackMock: vi.fn(),
  getProjectsMock: vi.fn(),
  homePageContentMock: vi.fn(() => <div data-testid="home-page-content" />),
  getProjectReviewQueueMock: vi.fn(),
  getProjectSourceConfigsMock: vi.fn(),
  getProjectTopicClusterMock: vi.fn(),
  getProjectTopicClustersMock: vi.fn(),
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

vi.mock("@/app/(home)/_components/HomePageContent", () => ({
  HomePageContent: homePageContentMock,
}))

vi.mock("@/lib/api", () => ({
  getProjectContents: getProjectContentsMock,
  getProjectEntities: getProjectEntitiesMock,
  getProjectFeedback: getProjectFeedbackMock,
  getProjects: getProjectsMock,
  getProjectReviewQueue: getProjectReviewQueueMock,
  getProjectSourceConfigs: getProjectSourceConfigsMock,
  getProjectTopicCluster: getProjectTopicClusterMock,
  getProjectTopicClusters: getProjectTopicClustersMock,
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
    topic_description: "AI news",
    content_retention_days: 30,
    user_role: "admin",
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
    canonical_url: "https://example.com/post",
    published_date: "2026-04-28T09:00:00Z",
    ingested_at: "2026-04-28T10:00:00Z",
    content_text: "A long article body for the dashboard preview.",
    relevance_score: 0.84,
    authority_adjusted_score: 0.88,
    embedding_id: "embed-1",
    duplicate_of: null,
    duplicate_signal_count: 0,
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
    mention_count: 0,
    latest_mentions: [],
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

function createTopicCluster(overrides: Partial<TopicCluster> = {}): TopicCluster {
  return {
    id: 5,
    project: 1,
    centroid_vector_id: "cluster-1",
    label: "Platform Signals",
    first_seen_at: "2026-04-26T08:00:00Z",
    last_seen_at: "2026-04-28T08:00:00Z",
    is_active: true,
    member_count: 1,
    dominant_entity: {
      id: 3,
      name: "OpenAI",
      type: "vendor",
    },
    velocity_score: 0.81,
    z_score: 1.7,
    window_count: 4,
    velocity_computed_at: "2026-04-28T08:00:00Z",
    ...overrides,
  }
}

function createTopicClusterDetail(
  overrides: Partial<TopicClusterDetail> = {},
): TopicClusterDetail {
  return {
    ...createTopicCluster(),
    memberships: [
      {
        id: 10,
        content: {
          id: 41,
          url: "https://example.com/post",
          title: "Useful AI briefing",
          published_date: "2026-04-28T09:00:00Z",
          source_plugin: "rss",
        },
        similarity: 0.92,
        assigned_at: "2026-04-28T10:00:00Z",
      },
    ],
    velocity_history: [],
    ...overrides,
  }
}

function createDashboardView(overrides: Record<string, unknown> = {}) {
  return {
    contentMap: new Map<number, Content>(),
    contentTypeFilter: "",
    contentTypes: [],
    daysFilter: 30,
    duplicateStateFilter: "",
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
  return import("./page")
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
    getProjectTopicClustersMock.mockReset()
    getProjectTopicClusterMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectContentsMock.mockResolvedValue(contents)
    getProjectReviewQueueMock.mockResolvedValue(reviewQueue)
    getProjectEntitiesMock.mockResolvedValue(entities)
    getProjectSourceConfigsMock.mockResolvedValue(sourceConfigs)
    getProjectFeedbackMock.mockResolvedValue(feedback)
    getProjectTopicClustersMock.mockResolvedValue([])
    getProjectTopicClusterMock.mockResolvedValue(createTopicClusterDetail())
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
    expect(getProjectTopicClustersMock).not.toHaveBeenCalled()
  })

  it("loads the derived dashboard state into HomePageContent", async () => {
    const content = createContent({
      title: "Useful AI briefing",
      is_reference: true,
      relevance_score: 0.84,
      authority_adjusted_score: 0.88,
      newsletter_promotion_at: "2026-04-28T11:00:00Z",
      newsletter_promotion_theme: 14,
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
    getProjectTopicClustersMock.mockResolvedValue([createTopicCluster()])
    getProjectTopicClusterMock.mockResolvedValue(
      createTopicClusterDetail({
        memberships: [
          {
            id: 10,
            content: {
              id: content.id,
              url: content.url,
              title: content.title,
              published_date: content.published_date,
              source_plugin: content.source_plugin,
            },
            similarity: 0.92,
            assigned_at: "2026-04-28T10:00:00Z",
          },
        ],
      }),
    )
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
      duplicateState: "duplicate_related",
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
          duplicateState: "duplicate_related",
        error: "Filter failed",
        message: "Filters applied",
        project: "1",
        source: "rss",
        view: "content",
      },
    })
    expect(homePageContentMock).toHaveBeenCalled()
    const props = (homePageContentMock.mock.calls[0] as unknown[] | undefined)?.[0] as
      | {
      positiveFeedback: number
      negativeFeedback: number
      errorMessage: string
      successMessage: string
      contentClusterLookup: Map<number, { clusterId: number; label: string; velocityScore: number | null }>
      sourceConfigs: SourceConfig[]
      entities: Entity[]
      filteredContents: Content[]
      pendingReviewItems: ReviewQueueItem[]
    }
      | undefined

    if (!props) {
      throw new Error("Expected HomePageContent props to be captured")
    }

    expect(props.errorMessage).toBe("Filter failed")
    expect(props.successMessage).toBe("Filters applied")
    expect(props.positiveFeedback).toBe(1)
    expect(props.negativeFeedback).toBe(1)
    expect(props.entities).toHaveLength(1)
    expect(props.sourceConfigs).toHaveLength(2)
    expect(props.filteredContents).toEqual([content])
    expect(props.pendingReviewItems).toEqual([reviewItem])
    expect(props.contentClusterLookup.get(content.id)).toEqual({
      clusterId: 5,
      label: "Platform Signals",
      velocityScore: 0.81,
    })
    expect(screen.getByTestId("home-page-content")).toBeInTheDocument()
    expect(getProjectTopicClustersMock).toHaveBeenCalledWith(1)
    expect(getProjectTopicClusterMock).toHaveBeenCalledWith(1, 5)
  })
})
