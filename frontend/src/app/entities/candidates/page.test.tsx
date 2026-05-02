import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Entity, EntityCandidate, Project } from "@/lib/types"

const {
  getProjectEntitiesMock,
  getProjectEntityCandidatesMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectEntitiesMock: vi.fn(),
  getProjectEntityCandidatesMock: vi.fn(),
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
  getProjectEntities: getProjectEntitiesMock,
  getProjectEntityCandidates: getProjectEntityCandidatesMock,
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
    website_url: "",
    github_url: "",
    linkedin_url: "",
    bluesky_handle: "",
    mastodon_handle: "",
    twitter_handle: "",
    mention_count: 0,
    latest_mentions: [],
    created_at: "2026-04-28T10:00:00Z",
    ...overrides,
  }
}

function createEntityCandidate(overrides: Partial<EntityCandidate> = {}): EntityCandidate {
  return {
    id: 14,
    project: 1,
    name: "River Labs",
    suggested_type: "vendor",
    first_seen_in: 21,
    first_seen_title: "River Labs launches hosted platform",
    occurrence_count: 3,
    cluster_key: "cluster-1",
    auto_promotion_blocked_reason: "needs_more_occurrences",
    evidence_count: 3,
    source_plugin_count: 2,
    source_plugins: ["linkedin", "rss"],
    identity_surfaces: ["linkedin"],
    status: "pending",
    merged_into: null,
    merged_into_name: "",
    created_at: "2026-04-28T10:00:00Z",
    updated_at: "2026-04-28T11:00:00Z",
    ...overrides,
  }
}

async function renderCandidateQueuePage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
) {
  const { default: CandidateQueuePage } = await import("./page")

  return render(
    await CandidateQueuePage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("CandidateQueuePage", () => {
  beforeEach(() => {
    const project = createProject()
    getProjectsMock.mockReset()
    getProjectEntitiesMock.mockReset()
    getProjectEntityCandidatesMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([project])
    getProjectEntitiesMock.mockResolvedValue([createEntity()])
    getProjectEntityCandidatesMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(project)
  })

  it("renders grouped pending candidate clusters", async () => {
    getProjectEntityCandidatesMock.mockResolvedValue([
      createEntityCandidate(),
      createEntityCandidate({
        id: 15,
        name: "River Labs AI",
        occurrence_count: 4,
        evidence_count: 4,
      }),
    ])

    await renderCandidateQueuePage({ project: "1" })

    expect(screen.getByText("Cluster of 2 candidates")).toBeInTheDocument()
    expect(screen.getByText("7 total occurrences")).toBeInTheDocument()
    expect(screen.getAllByText("linkedin").length).toBeGreaterThan(0)
    expect(screen.getByText("Accept cluster")).toBeInTheDocument()
    expect(screen.getByText("Merge cluster")).toBeInTheDocument()
  })

  it("renders the auto-promotion log tab", async () => {
    getProjectEntityCandidatesMock.mockResolvedValue([
      createEntityCandidate({
        id: 18,
        status: "accepted",
        updated_at: "2026-05-02T12:00:00Z",
      }),
    ])

    await renderCandidateQueuePage({ project: "1", tab: "auto-log" })

    expect(screen.getByText(/Resolved May 2, 2026/)).toBeInTheDocument()
    expect(screen.getByText("accepted")).toBeInTheDocument()
    expect(screen.getByText("2 sources")).toBeInTheDocument()
  })
})