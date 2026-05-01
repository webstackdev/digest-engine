import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Content, Project, TopicCluster, TopicClusterDetail } from "@/lib/types"

const {
  getProjectContentsMock,
  getProjectTopicClusterMock,
  getProjectTopicClustersMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectContentsMock: vi.fn(),
  getProjectTopicClusterMock: vi.fn(),
  getProjectTopicClustersMock: vi.fn(),
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
  getProjectContents: getProjectContentsMock,
  getProjectTopicCluster: getProjectTopicClusterMock,
  getProjectTopicClusters: getProjectTopicClustersMock,
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
    velocity_history: [
      {
        id: 2,
        cluster: 5,
        project: 1,
        computed_at: "2026-04-27T08:00:00Z",
        window_count: 3,
        trailing_mean: 1,
        trailing_stddev: 0.5,
        z_score: 1.2,
        velocity_score: 0.5,
      },
      {
        id: 3,
        cluster: 5,
        project: 1,
        computed_at: "2026-04-28T08:00:00Z",
        window_count: 4,
        trailing_mean: 1,
        trailing_stddev: 0.5,
        z_score: 1.7,
        velocity_score: 0.81,
      },
    ],
    ...overrides,
  }
}

async function loadTrendsPageModule() {
  return import("../page")
}

async function renderTrendsPage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
) {
  const { default: TrendsPage } = await loadTrendsPageModule()

  return render(
    await TrendsPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("buildVelocityTrendPoints", () => {
  it("returns a sparkline across ordered velocity snapshots", async () => {
    const { buildVelocityTrendPoints } = await loadTrendsPageModule()

    expect(
      buildVelocityTrendPoints(createTopicClusterDetail().velocity_history),
    ).toBe("0.0,36.0 220.0,18.6")
  })
})

describe("TrendsPage", () => {
  beforeEach(() => {
    const project = createProject()

    getProjectsMock.mockReset()
    getProjectContentsMock.mockReset()
    getProjectTopicClustersMock.mockReset()
    getProjectTopicClusterMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([project])
    getProjectContentsMock.mockResolvedValue([createContent()])
    getProjectTopicClustersMock.mockResolvedValue([createTopicCluster()])
    getProjectTopicClusterMock.mockResolvedValue(createTopicClusterDetail())
    selectProjectMock.mockReturnValue(project)
  })

  it("renders cluster cards and member drill-down content", async () => {
    await renderTrendsPage({ project: "1", cluster: "5" })

    expect(screen.getByText("Trend analysis")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Platform Signals" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Useful AI briefing")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open detail" })).toHaveAttribute(
      "href",
      "/content/41?project=1",
    )
    expect(getProjectTopicClustersMock).toHaveBeenCalledWith(1)
    expect(getProjectTopicClusterMock).toHaveBeenCalledWith(1, 5)
  })
})