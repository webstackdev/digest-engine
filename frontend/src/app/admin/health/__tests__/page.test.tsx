import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  IngestionRun,
  Project,
  SourceConfig,
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
} from "@/lib/types"

const {
  getProjectIngestionRunsMock,
  getProjectsMock,
  getProjectSourceConfigsMock,
  getProjectTopicCentroidSnapshotsMock,
  getProjectTopicCentroidSummaryMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectIngestionRunsMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getProjectSourceConfigsMock: vi.fn(),
  getProjectTopicCentroidSnapshotsMock: vi.fn(),
  getProjectTopicCentroidSummaryMock: vi.fn(),
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
  getProjectIngestionRuns: getProjectIngestionRunsMock,
  getProjects: getProjectsMock,
  getProjectSourceConfigs: getProjectSourceConfigsMock,
  getProjectTopicCentroidSnapshots: getProjectTopicCentroidSnapshotsMock,
  getProjectTopicCentroidSummary: getProjectTopicCentroidSummaryMock,
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

function createSourceConfig(
  overrides: Partial<SourceConfig> = {},
): SourceConfig {
  return {
    id: 7,
    project: 1,
    plugin_name: "rss",
    config: { feed_url: "https://example.com/feed.xml" },
    is_active: true,
    last_fetched_at: "2026-04-28T08:00:00Z",
    ...overrides,
  }
}

function createIngestionRun(
  overrides: Partial<IngestionRun> = {},
): IngestionRun {
  return {
    id: 22,
    project: 1,
    plugin_name: "rss",
    started_at: "2026-04-28T09:00:00Z",
    completed_at: "2026-04-28T09:03:00Z",
    status: "success",
    items_fetched: 12,
    items_ingested: 9,
    error_message: "",
    ...overrides,
  }
}

function createTopicCentroidSummary(
  overrides: Partial<TopicCentroidObservabilitySummary> = {},
): TopicCentroidObservabilitySummary {
  return {
    project: 1,
    snapshot_count: 0,
    active_snapshot_count: 0,
    avg_drift_from_previous: null,
    avg_drift_from_week_ago: null,
    latest_snapshot: null,
    ...overrides,
  }
}

function createTopicCentroidSnapshot(
  overrides: Partial<TopicCentroidSnapshot> = {},
): TopicCentroidSnapshot {
  return {
    id: 5,
    project: 1,
    computed_at: "2026-04-28T08:00:00Z",
    centroid_active: true,
    feedback_count: 12,
    upvote_count: 10,
    downvote_count: 2,
    drift_from_previous: 0.1,
    drift_from_week_ago: 0.2,
    ...overrides,
  }
}

async function loadHealthPageModule() {
  return import("../page")
}

async function renderHealthPage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
) {
  const { default: HealthPage } = await loadHealthPageModule()

  return render(
    await HealthPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("deriveSourceStatus", () => {
  it('returns "idle" for inactive sources', async () => {
    const { deriveSourceStatus } = await loadHealthPageModule()

    expect(deriveSourceStatus(false, "success", "2026-04-28T08:00:00Z")).toBe(
      "idle",
    )
  })

  it('returns "failing" for failed ingestion runs', async () => {
    const { deriveSourceStatus } = await loadHealthPageModule()

    expect(deriveSourceStatus(true, "failed", "2026-04-28T08:00:00Z")).toBe(
      "failing",
    )
  })

  it('returns "degraded" for running ingestion runs', async () => {
    const { deriveSourceStatus } = await loadHealthPageModule()

    expect(deriveSourceStatus(true, "running", "2026-04-28T08:00:00Z")).toBe(
      "degraded",
    )
  })

  it('returns "degraded" when the source has never fetched', async () => {
    const { deriveSourceStatus } = await loadHealthPageModule()

    expect(deriveSourceStatus(true, null, null)).toBe("degraded")
  })

  it('returns "healthy" when the source is active and has successful history', async () => {
    const { deriveSourceStatus } = await loadHealthPageModule()

    expect(deriveSourceStatus(true, "success", "2026-04-28T08:00:00Z")).toBe(
      "healthy",
    )
  })
})

describe("buildCentroidDriftTrendPoints", () => {
  it("returns a sparkline across ordered centroid snapshots", async () => {
    const { buildCentroidDriftTrendPoints } = await loadHealthPageModule()

    expect(
      buildCentroidDriftTrendPoints([
        createTopicCentroidSnapshot({
          id: 2,
          computed_at: "2026-04-29T08:00:00Z",
          drift_from_previous: 0.3,
        }),
        createTopicCentroidSnapshot({
          id: 1,
          computed_at: "2026-04-28T08:00:00Z",
          drift_from_previous: 0.1,
        }),
      ]),
    ).toBe("0.0,64.8 220.0,50.4")
  })
})

describe("HealthPage", () => {
  beforeEach(() => {
    const defaultProject = createProject()

    getProjectsMock.mockReset()
    getProjectSourceConfigsMock.mockReset()
    getProjectIngestionRunsMock.mockReset()
    getProjectTopicCentroidSnapshotsMock.mockReset()
    getProjectTopicCentroidSummaryMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectSourceConfigsMock.mockResolvedValue([])
    getProjectIngestionRunsMock.mockResolvedValue([])
    getProjectTopicCentroidSnapshotsMock.mockResolvedValue([])
    getProjectTopicCentroidSummaryMock.mockResolvedValue(
      createTopicCentroidSummary(),
    )
    selectProjectMock.mockImplementation((projects: Project[]) => {
      return projects[0] ?? null
    })
  })

  it("renders the no-project empty state and skips project-scoped API calls", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderHealthPage({})

    expect(selectProjectMock).toHaveBeenCalledWith([], {})
    expect(
      screen.getByText("No project found for this API user."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Create a project first in Django admin."),
    ).toBeInTheDocument()
    expect(getProjectSourceConfigsMock).not.toHaveBeenCalled()
    expect(getProjectIngestionRunsMock).not.toHaveBeenCalled()
    expect(getProjectTopicCentroidSnapshotsMock).not.toHaveBeenCalled()
    expect(getProjectTopicCentroidSummaryMock).not.toHaveBeenCalled()
  })

  it("renders an empty source-configurations row when the project has no sources", async () => {
    await renderHealthPage()

    expect(
      screen.getByText("No centroid snapshots exist for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No source configurations exist for this project yet."),
    ).toBeInTheDocument()
    expect(getProjectSourceConfigsMock).toHaveBeenCalledWith(1)
    expect(getProjectIngestionRunsMock).toHaveBeenCalledWith(1)
    expect(getProjectTopicCentroidSnapshotsMock).toHaveBeenCalledWith(1)
    expect(getProjectTopicCentroidSummaryMock).toHaveBeenCalledWith(1)
  })

  it("shows a no-runs message for sources without ingestion history", async () => {
    getProjectSourceConfigsMock.mockResolvedValue([
      createSourceConfig({ plugin_name: "reddit" }),
    ])

    await renderHealthPage()

    expect(screen.getByText("reddit", { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
  })

  it("passes the resolved search params to selectProject and renders source names", async () => {
    const projects = [createProject({ id: 2, name: "Data Signals" })]
    getProjectsMock.mockResolvedValue(projects)
    selectProjectMock.mockReturnValue(projects[0])
    getProjectSourceConfigsMock.mockResolvedValue([
      createSourceConfig({ project: 2, plugin_name: "rss" }),
    ])

    await renderHealthPage({ project: "2" })

    expect(selectProjectMock).toHaveBeenCalledWith(projects, { project: "2" })
    expect(screen.getByText("rss", { selector: "strong" })).toBeInTheDocument()
  })

  it("maps derived health states to badge tones and labels", async () => {
    const selectedProject = createProject({ id: 3 })
    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectSourceConfigsMock.mockResolvedValue([
      createSourceConfig({
        id: 1,
        project: 3,
        plugin_name: "rss",
        last_fetched_at: "2026-04-28T08:00:00Z",
      }),
      createSourceConfig({
        id: 2,
        project: 3,
        plugin_name: "reddit",
        last_fetched_at: "2026-04-28T08:00:00Z",
      }),
    ])
    getProjectIngestionRunsMock.mockResolvedValue([
      createIngestionRun({ project: 3, plugin_name: "rss", status: "success" }),
      createIngestionRun({ project: 3, plugin_name: "reddit", status: "failed" }),
    ])

    await renderHealthPage({ project: "3" })

    const badges = screen.getAllByTestId("status-badge")
    const healthyBadge = badges.find((badge) => badge.textContent === "healthy")
    const failingBadge = badges.find((badge) => badge.textContent === "failing")

    expect(healthyBadge).toHaveAttribute("data-tone", "positive")
    expect(failingBadge).toHaveAttribute("data-tone", "negative")
  })

  it("renders centroid summary cards for the selected project", async () => {
    getProjectTopicCentroidSnapshotsMock.mockResolvedValue([
      createTopicCentroidSnapshot({
        id: 7,
        computed_at: "2026-04-26T08:00:00Z",
        drift_from_previous: 0.05,
      }),
      createTopicCentroidSnapshot({
        id: 8,
        computed_at: "2026-04-27T08:00:00Z",
        drift_from_previous: 0.1,
      }),
      createTopicCentroidSnapshot({
        id: 9,
        computed_at: "2026-04-28T08:00:00Z",
        drift_from_previous: 0.2,
      }),
    ])
    getProjectTopicCentroidSummaryMock.mockResolvedValue(
      createTopicCentroidSummary({
        snapshot_count: 3,
        active_snapshot_count: 2,
        avg_drift_from_previous: 0.1,
        avg_drift_from_week_ago: 0.2,
        latest_snapshot: {
          id: 9,
          project: 1,
          computed_at: "2026-04-28T08:00:00Z",
          centroid_active: true,
          feedback_count: 14,
          upvote_count: 11,
          downvote_count: 3,
          drift_from_previous: 0.1,
          drift_from_week_ago: 0.2,
        },
      }),
    )

    await renderHealthPage()

    expect(
      screen.getByText("Topic centroid observability"),
    ).toBeInTheDocument()
    expect(screen.getAllByText("10.0%").length).toBeGreaterThan(0)
    expect(screen.getAllByText("20.0%").length).toBeGreaterThan(0)
    expect(screen.getByText("Feedback 14")).toBeInTheDocument()
    expect(screen.getAllByText("active").length).toBeGreaterThan(0)
    expect(
      screen.getByRole("link", { name: "Open centroid snapshot history" }),
    ).toHaveAttribute(
      "href",
      "/admin/health?project=1#centroid-snapshot-history",
    )
    expect(
      screen.getByLabelText("Centroid drift trend"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Centroid snapshot history"),
    ).toBeInTheDocument()
    expect(screen.getByText("Showing 3 of 3 snapshots")).toBeInTheDocument()
  })
})
