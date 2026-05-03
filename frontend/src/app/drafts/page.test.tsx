import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { NewsletterDraft, Project } from "@/lib/types"

const {
  getProjectNewsletterDraftsMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectNewsletterDraftsMock: vi.fn(),
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
  getProjectNewsletterDrafts: getProjectNewsletterDraftsMock,
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

function createDraft(overrides: Partial<NewsletterDraft> = {}): NewsletterDraft {
  return {
    id: 8,
    project: 1,
    title: "AI Weekly: Delivery signals and more",
    intro: "A quick editor-ready summary.",
    outro: "Closing thought.",
    target_publish_date: "2026-05-08",
    status: "ready",
    generated_at: "2026-05-03T09:00:00Z",
    last_edited_at: null,
    generation_metadata: {
      source_theme_ids: [1, 2],
      source_idea_ids: [4],
      trigger_source: "manual",
      models: { section_composer: "heuristic" },
    },
    sections: [],
    original_pieces: [],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

async function renderDraftsPage() {
  const { default: DraftsPage } = await import("./page")

  return render(
    await DraftsPage({
      searchParams: Promise.resolve({ project: "1" }),
    }),
  )
}

describe("DraftsPage", () => {
  beforeEach(() => {
    const project = createProject()
    getProjectsMock.mockReset()
    getProjectNewsletterDraftsMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([project])
    getProjectNewsletterDraftsMock.mockResolvedValue([createDraft()])
    selectProjectMock.mockReturnValue(project)
  })

  it("renders draft cards and the generate action", async () => {
    await renderDraftsPage()

    expect(screen.getByText("Newsletter drafts")).toBeInTheDocument()
    expect(screen.getByText("AI Weekly: Delivery signals and more")).toBeInTheDocument()
    expect(screen.getByText(/Generated/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate now" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open draft" })).toHaveAttribute(
      "href",
      "/drafts/8?project=1",
    )
  })
})
