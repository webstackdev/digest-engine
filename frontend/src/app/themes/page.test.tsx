import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Project, ThemeSuggestion, TopicCluster, TopicClusterDetail } from "@/lib/types"

const {
  getProjectsMock,
  getProjectThemeSuggestionsMock,
  getProjectTopicClusterMock,
  getProjectTopicClustersMock,
  themesPageContentMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectsMock: vi.fn(),
  getProjectThemeSuggestionsMock: vi.fn(),
  getProjectTopicClusterMock: vi.fn(),
  getProjectTopicClustersMock: vi.fn(),
  themesPageContentMock: vi.fn(() => <div data-testid="themes-page-content" />),
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

vi.mock("@/app/themes/_components/ThemesPageContent", () => ({
  ThemesPageContent: themesPageContentMock,
}))

vi.mock("@/lib/api", () => ({
  getProjects: getProjectsMock,
  getProjectThemeSuggestions: getProjectThemeSuggestionsMock,
  getProjectTopicCluster: getProjectTopicClusterMock,
  getProjectTopicClusters: getProjectTopicClustersMock,
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

function createTopicCluster(overrides: Partial<TopicCluster> = {}): TopicCluster {
  return {
    id: 5,
    project: 1,
    centroid_vector_id: "cluster-1",
    label: "Platform Signals",
    first_seen_at: "2026-04-26T08:00:00Z",
    last_seen_at: "2026-04-28T08:00:00Z",
    is_active: true,
    member_count: 3,
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

function createThemeSuggestion(
  overrides: Partial<ThemeSuggestion> = {},
): ThemeSuggestion {
  return {
    id: 7,
    project: 1,
    cluster: {
      id: 5,
      label: "Platform Signals",
      member_count: 3,
      velocity_score: 0.81,
    },
    title: "Owner the orchestration angle",
    pitch: "Pitch text",
    why_it_matters: "Why it matters",
    suggested_angle: "Suggested angle",
    velocity_at_creation: 0.81,
    novelty_score: 0.73,
    status: "pending",
    dismissal_reason: "",
    created_at: "2026-04-28T12:00:00Z",
    decided_at: null,
    decided_by: null,
    decided_by_username: null,
    promoted_contents: [],
    ...overrides,
  }
}

async function renderThemesPage() {
  const { default: ThemesPage } = await import("./page")

  return render(
    await ThemesPage({
      searchParams: Promise.resolve({ project: "1" }),
    }),
  )
}

describe("ThemesPage", () => {
  beforeEach(() => {
    const project = createProject()
    getProjectsMock.mockReset()
    getProjectThemeSuggestionsMock.mockReset()
    getProjectTopicClustersMock.mockReset()
    getProjectTopicClusterMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([project])
    getProjectThemeSuggestionsMock.mockResolvedValue([createThemeSuggestion()])
    getProjectTopicClustersMock.mockResolvedValue([createTopicCluster()])
    getProjectTopicClusterMock.mockResolvedValue(createTopicClusterDetail())
    themesPageContentMock.mockClear()
    selectProjectMock.mockReturnValue(project)
  })

  it("renders the missing-project guard when no project is available", async () => {
    selectProjectMock.mockReturnValue(null)

    await renderThemesPage()

    expect(screen.getByText("Create a project first in Django admin.")).toBeInTheDocument()
    expect(getProjectThemeSuggestionsMock).not.toHaveBeenCalled()
  })

  it("loads the queue data into ThemesPageContent", async () => {
    const project = createProject()
    const theme = createThemeSuggestion()
    const cluster = createTopicCluster()
    const clusterDetail = createTopicClusterDetail()

    getProjectsMock.mockResolvedValue([project])
    getProjectThemeSuggestionsMock.mockResolvedValue([theme])
    getProjectTopicClustersMock.mockResolvedValue([cluster])
    getProjectTopicClusterMock.mockResolvedValue(clusterDetail)
    selectProjectMock.mockReturnValue(project)

    await renderThemesPage()

    expect(themesPageContentMock).toHaveBeenCalled()
    const props = (themesPageContentMock.mock.calls[0] as unknown[] | undefined)?.[0]

    expect(props).toEqual({
      projects: [project],
      selectedProject: project,
      themes: [theme],
      clusters: [cluster],
      clusterDetails: [clusterDetail],
      selectedThemeId: 0,
      statusFilter: "all",
      errorMessage: "",
      successMessage: "",
    })
    expect(screen.getByTestId("themes-page-content")).toBeInTheDocument()
  })
})
