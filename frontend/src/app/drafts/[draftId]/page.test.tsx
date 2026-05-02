import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { NewsletterDraft, Project } from "@/lib/types"

const {
  getProjectNewsletterDraftMock,
  getProjectsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectNewsletterDraftMock: vi.fn(),
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

vi.mock("@/app/drafts/[draftId]/_components/DraftEditor", () => ({
  DraftEditor: ({ projectId }: { projectId: number }) => (
    <div data-testid="draft-editor">Draft editor for project {projectId}</div>
  ),
}))

vi.mock("@/lib/api", () => ({
  getProjectNewsletterDraft: getProjectNewsletterDraftMock,
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
      coherence_suggestions: ["Tighten the intro transition."],
    },
    sections: [
      {
        id: 21,
        draft: 8,
        theme_suggestion: 3,
        theme_suggestion_detail: {
          id: 3,
          title: "Delivery signals",
          pitch: "Pitch",
          why_it_matters: "Why it matters",
        },
        title: "Delivery signals",
        lede: "Section lede.",
        order: 0,
        items: [
          {
            id: 44,
            section: 21,
            content: 55,
            content_detail: {
              id: 55,
              url: "https://example.com/post",
              title: "Useful article",
              source_plugin: "rss",
              published_date: "2026-05-02T10:00:00Z",
            },
            summary_used: "Item summary.",
            why_it_matters: "Item why.",
            order: 0,
          },
        ],
      },
    ],
    original_pieces: [
      {
        id: 31,
        draft: 8,
        idea: 9,
        idea_detail: {
          id: 9,
          angle_title: "Original idea",
          summary: "Summary",
          suggested_outline: "1. Outline",
        },
        title: "Original idea",
        pitch: "Pitch",
        suggested_outline: "1. Outline",
        order: 0,
      },
    ],
    rendered_markdown: "# Draft",
    rendered_html: "<h1>Draft</h1>",
    ...overrides,
  }
}

async function renderDraftDetailPage(searchParams: Record<string, string> = { project: "1" }) {
  const { default: DraftDetailPage } = await import("./page")

  return render(
    await DraftDetailPage({
      params: Promise.resolve({ draftId: "8" }),
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("DraftDetailPage", () => {
  beforeEach(() => {
    const project = createProject()
    getProjectsMock.mockReset()
    getProjectNewsletterDraftMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([project])
    getProjectNewsletterDraftMock.mockResolvedValue(createDraft())
    selectProjectMock.mockReturnValue(project)
  })

  it("renders the editor view with top-level form and section regeneration", async () => {
    await renderDraftDetailPage()

    expect(screen.getByText("Draft detail")).toBeInTheDocument()
    expect(screen.getByTestId("draft-editor")).toHaveTextContent(
      "Draft editor for project 1",
    )
  })

  it("renders the markdown export view when requested", async () => {
    await renderDraftDetailPage({ project: "1", view: "markdown" })

    expect(screen.getByText("Rendered markdown")).toBeInTheDocument()
    expect(screen.getByText("# Draft")).toBeInTheDocument()
  })
})