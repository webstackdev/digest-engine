import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  IngestionRun,
  Project,
  SourceConfig,
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
  TrendTaskRun,
  TrendTaskRunObservabilitySummary,
} from "@/lib/types"

const {
  getProjectIngestionRunsMock,
  getProjectsMock,
  getProjectSourceDiversitySnapshotsMock,
  getProjectSourceDiversitySummaryMock,
  getProjectSourceConfigsMock,
  getProjectTrendTaskRunsMock,
  getProjectTopicCentroidSnapshotsMock,
  getProjectTopicCentroidSummaryMock,
  getProjectTrendTaskRunSummaryMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectIngestionRunsMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getProjectSourceDiversitySnapshotsMock: vi.fn(),
  getProjectSourceDiversitySummaryMock: vi.fn(),
  getProjectSourceConfigsMock: vi.fn(),
  getProjectTrendTaskRunsMock: vi.fn(),
  getProjectTopicCentroidSnapshotsMock: vi.fn(),
  getProjectTopicCentroidSummaryMock: vi.fn(),
  getProjectTrendTaskRunSummaryMock: vi.fn(),
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
  getProjectIngestionRuns: getProjectIngestionRunsMock,
  getProjects: getProjectsMock,
  getProjectSourceDiversitySnapshots: getProjectSourceDiversitySnapshotsMock,
  getProjectSourceDiversitySummary: getProjectSourceDiversitySummaryMock,
  getProjectSourceConfigs: getProjectSourceConfigsMock,
  getProjectTrendTaskRuns: getProjectTrendTaskRunsMock,
  getProjectTopicCentroidSnapshots: getProjectTopicCentroidSnapshotsMock,
  getProjectTopicCentroidSummary: getProjectTopicCentroidSummaryMock,
  getProjectTrendTaskRunSummary: getProjectTrendTaskRunSummaryMock,
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

function createSourceDiversitySnapshot(
  overrides: Partial<SourceDiversitySnapshot> = {},
): SourceDiversitySnapshot {
  return {
    id: 3,
    project: 1,
    computed_at: "2026-04-28T08:00:00Z",
    window_days: 14,
    plugin_entropy: 0.65,
    source_entropy: 0.72,
    author_entropy: 0.48,
    cluster_entropy: 0.58,
    top_plugin_share: 0.62,
    top_source_share: 0.44,
    breakdown: {
      total_content_count: 12,
      plugin_counts: [
        { key: "rss", label: "rss", count: 7, share: 0.58 },
      ],
      source_counts: [
        { key: "feed:1", label: "Example Feed", count: 5, share: 0.42 },
      ],
      author_counts: [],
      cluster_counts: [],
      alerts: [],
    },
    ...overrides,
  }
}

function createSourceDiversitySummary(
  overrides: Partial<SourceDiversityObservabilitySummary> = {},
): SourceDiversityObservabilitySummary {
  return {
    project: 1,
    snapshot_count: 0,
    latest_snapshot: null,
    ...overrides,
  }
}

function createTrendTaskRun(
  overrides: Partial<TrendTaskRun> = {},
): TrendTaskRun {
  return {
    id: 41,
    project: 1,
    task_name: "recompute_topic_centroid",
    task_run_id: "95ae5b14-5d7d-498e-9adc-1dbaab4dd4b8",
    status: "completed",
    started_at: "2026-04-28T08:00:00Z",
    finished_at: "2026-04-28T08:00:01Z",
    latency_ms: 523,
    error_message: "",
    summary: {
      project_id: 1,
      feedback_count: 12,
      upvote_count: 10,
      downvote_count: 2,
      centroid_active: true,
    },
    ...overrides,
  }
}

function createTrendTaskRunSummary(
  overrides: Partial<TrendTaskRunObservabilitySummary> = {},
): TrendTaskRunObservabilitySummary {
  return {
    project: 1,
    run_count: 0,
    failed_run_count: 0,
    latest_runs: [],
    ...overrides,
  }
}

async function loadHealthPageModule() {
  return import("./page")
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
    getProjectSourceDiversitySnapshotsMock.mockReset()
    getProjectSourceDiversitySummaryMock.mockReset()
    getProjectTrendTaskRunsMock.mockReset()
    getProjectTopicCentroidSnapshotsMock.mockReset()
    getProjectTopicCentroidSummaryMock.mockReset()
    getProjectTrendTaskRunSummaryMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectSourceConfigsMock.mockResolvedValue([])
    getProjectIngestionRunsMock.mockResolvedValue([])
    getProjectSourceDiversitySnapshotsMock.mockResolvedValue([])
    getProjectSourceDiversitySummaryMock.mockResolvedValue(
      createSourceDiversitySummary(),
    )
    getProjectTrendTaskRunsMock.mockResolvedValue([])
    getProjectTopicCentroidSnapshotsMock.mockResolvedValue([])
    getProjectTopicCentroidSummaryMock.mockResolvedValue(
      createTopicCentroidSummary(),
    )
    getProjectTrendTaskRunSummaryMock.mockResolvedValue(
      createTrendTaskRunSummary(),
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
    expect(getProjectSourceDiversitySnapshotsMock).not.toHaveBeenCalled()
    expect(getProjectSourceDiversitySummaryMock).not.toHaveBeenCalled()
    expect(getProjectTrendTaskRunsMock).not.toHaveBeenCalled()
    expect(getProjectTopicCentroidSnapshotsMock).not.toHaveBeenCalled()
    expect(getProjectTopicCentroidSummaryMock).not.toHaveBeenCalled()
    expect(getProjectTrendTaskRunSummaryMock).not.toHaveBeenCalled()
  })

  it("renders an empty source-configurations row when the project has no sources", async () => {
    await renderHealthPage()

    expect(
      screen.getByText("No centroid snapshots exist for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No source-diversity snapshots exist for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No source configurations exist for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No trend pipeline runs have been persisted for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No trend task run history exists for this project yet."),
    ).toBeInTheDocument()
    expect(getProjectSourceConfigsMock).toHaveBeenCalledWith(1)
    expect(getProjectIngestionRunsMock).toHaveBeenCalledWith(1)
    expect(getProjectSourceDiversitySnapshotsMock).toHaveBeenCalledWith(1)
    expect(getProjectSourceDiversitySummaryMock).toHaveBeenCalledWith(1)
    expect(getProjectTrendTaskRunsMock).toHaveBeenCalledWith(1)
    expect(getProjectTopicCentroidSnapshotsMock).toHaveBeenCalledWith(1)
    expect(getProjectTopicCentroidSummaryMock).toHaveBeenCalledWith(1)
    expect(getProjectTrendTaskRunSummaryMock).toHaveBeenCalledWith(1)
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

  it("renders source diversity metrics and alert details", async () => {
    getProjectSourceDiversitySummaryMock.mockResolvedValue(
      createSourceDiversitySummary({
        snapshot_count: 2,
        latest_snapshot: createSourceDiversitySnapshot({
          top_plugin_share: 0.74,
          breakdown: {
            total_content_count: 14,
            plugin_counts: [
              { key: "rss", label: "rss", count: 10, share: 0.74 },
            ],
            source_counts: [
              { key: "feed:1", label: "Example Feed", count: 8, share: 0.57 },
            ],
            author_counts: [],
            cluster_counts: [],
            alerts: [
              {
                code: "top_plugin_share",
                severity: "warning",
                message: "Your stream is 70%+ from RSS this week.",
              },
            ],
          },
        }),
      }),
    )
    getProjectSourceDiversitySnapshotsMock.mockResolvedValue([
      createSourceDiversitySnapshot({
        id: 1,
        computed_at: "2026-04-27T08:00:00Z",
        top_plugin_share: 0.68,
      }),
      createSourceDiversitySnapshot({
        id: 2,
        computed_at: "2026-04-28T08:00:00Z",
        top_plugin_share: 0.74,
      }),
    ])

    await renderHealthPage()

    expect(
      screen.getByRole("heading", { level: 2, name: "Source diversity" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Your stream is 70%+ from RSS this week.")).toBeInTheDocument()
    expect(screen.getAllByText("74%").length).toBeGreaterThan(0)
    expect(screen.getByText("View raw breakdown JSON")).toBeInTheDocument()
    expect(screen.getByLabelText("Source diversity trend")).toBeInTheDocument()
  })

  it("renders the latest trend pipeline task runs", async () => {
    getProjectTrendTaskRunsMock.mockResolvedValue([
      createTrendTaskRun({
        id: 43,
        task_name: "generate_theme_suggestions",
        started_at: "2026-04-28T08:20:00Z",
        finished_at: "2026-04-28T08:20:01Z",
        latency_ms: 1480,
        status: "failed",
        error_message: "OpenRouter timeout",
        summary: { project_id: 1, created: 0, updated: 0, skipped: 2 },
      }),
      createTrendTaskRun({
        id: 41,
        started_at: "2026-04-28T08:00:00Z",
        finished_at: "2026-04-28T08:00:01Z",
      }),
    ])
    getProjectTrendTaskRunSummaryMock.mockResolvedValue(
      createTrendTaskRunSummary({
        run_count: 8,
        failed_run_count: 1,
        latest_runs: [
          createTrendTaskRun(),
          createTrendTaskRun({
            id: 42,
            task_name: "generate_theme_suggestions",
            status: "failed",
            latency_ms: 1480,
            error_message: "OpenRouter timeout",
            summary: { project_id: 1, created: 0, updated: 0, skipped: 2 },
          }),
        ],
      }),
    )

    await renderHealthPage()

    expect(
      screen.getByRole("heading", { level: 2, name: "Trend pipeline runs" }),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Topic centroid").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Theme suggestions").length).toBeGreaterThan(0)
    expect(
      screen.getAllByText("feedback 12 • upvotes 10 • downvotes 2").length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText("OpenRouter timeout").length).toBeGreaterThan(0)
    expect(screen.getAllByText("1.5s").length).toBeGreaterThan(0)
    expect(screen.getByText("8")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Open trend task run history" }),
    ).toHaveAttribute(
      "href",
      "/admin/health?project=1#trend-task-run-history",
    )
    expect(
      screen.getByRole("heading", { level: 2, name: "Trend task run history" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Showing 2 of 8 runs")).toBeInTheDocument()
  })
})
