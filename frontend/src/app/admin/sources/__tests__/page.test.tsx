import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { IngestionRun, Project, SourceConfig } from "@/lib/types"

const {
  getProjectIngestionRunsMock,
  getProjectsMock,
  getProjectSourceConfigsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectIngestionRunsMock: vi.fn(),
  getProjectsMock: vi.fn(),
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
  getProjectIngestionRuns: getProjectIngestionRunsMock,
  getProjects: getProjectsMock,
  getProjectSourceConfigs: getProjectSourceConfigsMock,
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

async function loadSourcesPageModule() {
  return import("../page")
}

async function renderSourcesPage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
) {
  const { default: SourcesPage } = await loadSourcesPageModule()

  return render(
    await SourcesPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("buildLatestRunByPlugin", () => {
  it("keeps the first run seen for each plugin", async () => {
    const { buildLatestRunByPlugin } = await loadSourcesPageModule()
    const newestRssRun = createIngestionRun({ id: 100, plugin_name: "rss" })
    const olderRssRun = createIngestionRun({ id: 90, plugin_name: "rss" })
    const redditRun = createIngestionRun({ id: 80, plugin_name: "reddit" })

    const latestRunByPlugin = buildLatestRunByPlugin([
      newestRssRun,
      olderRssRun,
      redditRun,
    ])

    expect(latestRunByPlugin.get("rss")).toEqual(newestRssRun)
    expect(latestRunByPlugin.get("reddit")).toEqual(redditRun)
  })
})

describe("SourcesPage", () => {
  beforeEach(() => {
    const defaultProject = createProject()

    getProjectsMock.mockReset()
    getProjectSourceConfigsMock.mockReset()
    getProjectIngestionRunsMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectSourceConfigsMock.mockResolvedValue([])
    getProjectIngestionRunsMock.mockResolvedValue([])
    selectProjectMock.mockImplementation((projects: Project[]) => {
      return projects[0] ?? null
    })
  })

  it("renders the no-project empty state and skips project-scoped API calls", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderSourcesPage({})

    expect(selectProjectMock).toHaveBeenCalledWith([], {})
    expect(
      screen.getByText("No project found for this API user."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Create a project first in Django admin."),
    ).toBeInTheDocument()
    expect(getProjectSourceConfigsMock).not.toHaveBeenCalled()
    expect(getProjectIngestionRunsMock).not.toHaveBeenCalled()
  })

  it("renders flash messages from the search params", async () => {
    await renderSourcesPage({
      error: "Could not save source",
      message: "Source saved",
      project: "1",
    })

    expect(selectProjectMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      {
        error: "Could not save source",
        message: "Source saved",
        project: "1",
      },
    )
    expect(screen.getByText("Could not save source")).toBeInTheDocument()
    expect(screen.getByText("Source saved")).toBeInTheDocument()
  })

  it("renders the empty source-config state when the project has no sources", async () => {
    await renderSourcesPage()

    expect(
      screen.getByText("No source configurations exist for this project yet."),
    ).toBeInTheDocument()
    expect(getProjectSourceConfigsMock).toHaveBeenCalledWith(1)
    expect(getProjectIngestionRunsMock).toHaveBeenCalledWith(1)
  })

  it("renders source cards with badge tones and the latest run summary", async () => {
    const selectedProject = createProject({ id: 3 })
    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectSourceConfigsMock.mockResolvedValue([
      createSourceConfig({
        id: 1,
        project: 3,
        plugin_name: "rss",
        is_active: true,
      }),
      createSourceConfig({
        id: 2,
        project: 3,
        plugin_name: "reddit",
        is_active: false,
      }),
    ])
    getProjectIngestionRunsMock.mockResolvedValue([
      createIngestionRun({
        id: 9,
        project: 3,
        plugin_name: "rss",
        status: "success",
      }),
      createIngestionRun({
        id: 8,
        project: 3,
        plugin_name: "rss",
        status: "failed",
      }),
      createIngestionRun({
        id: 7,
        project: 3,
        plugin_name: "reddit",
        status: "failed",
        error_message: "Rate limited",
      }),
    ])

    await renderSourcesPage({ project: "3" })

    expect(screen.getByRole("heading", { name: "rss" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "reddit" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Latest run: success")).toBeInTheDocument()
    expect(screen.getByText("Latest run: failed")).toBeInTheDocument()
    expect(screen.getByText("Rate limited")).toBeInTheDocument()

    const badges = screen.getAllByTestId("status-badge")
    expect(badges).toHaveLength(2)
    expect(badges[0]).toHaveAttribute("data-tone", "positive")
    expect(badges[0]).toHaveTextContent("active")
    expect(badges[1]).toHaveAttribute("data-tone", "neutral")
    expect(badges[1]).toHaveTextContent("disabled")
  })

  it("shows fallback latest-run text when a source has no ingestion history", async () => {
    getProjectSourceConfigsMock.mockResolvedValue([
      createSourceConfig({ plugin_name: "reddit" }),
    ])

    await renderSourcesPage({ project: "1" })

    expect(screen.getByText("Latest run: none")).toBeInTheDocument()
    expect(screen.getByText("No recent error")).toBeInTheDocument()
  })
})