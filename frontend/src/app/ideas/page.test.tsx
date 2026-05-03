import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { OriginalContentIdea, Project } from "@/lib/types"

const {
  getProjectOriginalContentIdeasMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectOriginalContentIdeasMock: vi.fn(),
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
  getProjectOriginalContentIdeas: getProjectOriginalContentIdeasMock,
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

function createIdea(overrides: Partial<OriginalContentIdea> = {}): OriginalContentIdea {
  return {
    id: 9,
    project: 1,
    angle_title: "Explain the operator gap",
    summary: "Summary",
    suggested_outline: "1. First\n2. Second",
    why_now: "Why now",
    supporting_contents: [
      {
        id: 41,
        url: "https://example.com/post",
        title: "Useful AI briefing",
        published_date: "2026-04-28T09:00:00Z",
        source_plugin: "rss",
      },
    ],
    related_cluster: {
      id: 5,
      label: "Platform Signals",
      member_count: 3,
    },
    generated_by_model: "heuristic",
    self_critique_score: 0.78,
    status: "pending",
    dismissal_reason: "",
    created_at: "2026-04-28T12:00:00Z",
    decided_at: null,
    decided_by: null,
    decided_by_username: null,
    ...overrides,
  }
}

async function renderIdeasPage() {
  const { default: IdeasPage } = await import("./page")

  return render(
    await IdeasPage({
      searchParams: Promise.resolve({ project: "1" }),
    }),
  )
}

async function renderIdeasPageWithSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { default: IdeasPage } = await import("./page")

  return render(
    await IdeasPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("IdeasPage", () => {
  beforeEach(() => {
    const project = createProject()
    getProjectsMock.mockReset()
    getProjectOriginalContentIdeasMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([project])
    getProjectOriginalContentIdeasMock.mockResolvedValue([createIdea()])
    selectProjectMock.mockReturnValue(project)
  })

  it("renders idea cards with supporting content and generate action", async () => {
    await renderIdeasPage()

    expect(screen.getByText("Original content ideas")).toBeInTheDocument()
    expect(screen.getByText("Explain the operator gap")).toBeInTheDocument()
    expect(screen.getByText("Useful AI briefing")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate now" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
  })

  it("renders the no-project empty state when selection fails", async () => {
    selectProjectMock.mockReturnValueOnce(null)

    await renderIdeasPageWithSearchParams({})

    expect(screen.getByText("Ideas")).toBeInTheDocument()
    expect(screen.getByText("Create a project first in Django admin.")).toBeInTheDocument()
    expect(getProjectOriginalContentIdeasMock).not.toHaveBeenCalled()
  })

  it("filters the queue by requested status", async () => {
    getProjectOriginalContentIdeasMock.mockResolvedValue([
      createIdea(),
      createIdea({
        id: 10,
        angle_title: "Accepted idea",
        status: "accepted",
        decided_at: "2026-04-29T09:00:00Z",
        decided_by: 2,
        decided_by_username: "editor-2",
      }),
    ])

    await renderIdeasPageWithSearchParams({ project: "1", status: "accepted" })

    expect(screen.getByText("Accepted idea")).toBeInTheDocument()
    expect(screen.queryByText("Explain the operator gap")).not.toBeInTheDocument()
  })
})
