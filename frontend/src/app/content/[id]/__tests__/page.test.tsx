import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  Content,
  Project,
  ReviewQueueItem,
  SkillResult,
  UserFeedback,
} from "@/lib/types"

const {
  getProjectContentMock,
  getProjectFeedbackMock,
  getProjectReviewQueueMock,
  getProjectsMock,
  getProjectSkillResultsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectContentMock: vi.fn(),
  getProjectFeedbackMock: vi.fn(),
  getProjectReviewQueueMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getProjectSkillResultsMock: vi.fn(),
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

vi.mock("@/components/skill-action-bar", () => ({
  SkillActionBar: ({
    canSummarize,
    contentId,
    initialPendingSkills,
    projectId,
  }: {
    canSummarize: boolean
    contentId: number
    initialPendingSkills: string[]
    projectId: number
  }) => (
    <div
      data-testid="skill-action-bar"
      data-can-summarize={canSummarize ? "true" : "false"}
      data-content-id={contentId}
      data-pending-skills={initialPendingSkills.join(",")}
      data-project-id={projectId}
    />
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
  getProjectContent: getProjectContentMock,
  getProjectFeedback: getProjectFeedbackMock,
  getProjectReviewQueue: getProjectReviewQueueMock,
  getProjects: getProjectsMock,
  getProjectSkillResults: getProjectSkillResultsMock,
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

function createContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 42,
    project: 1,
    url: "https://example.com/article",
    title: "Important AI update",
    author: "Ada Lovelace",
    entity: null,
    source_plugin: "rss",
    content_type: "article",
    published_date: "2026-04-28T09:00:00Z",
    ingested_at: "2026-04-28T10:00:00Z",
    content_text: "Body copy",
    relevance_score: 0.82,
    embedding_id: "embed-1",
    is_reference: false,
    is_active: true,
    ...overrides,
  }
}

function createSkillResult(overrides: Partial<SkillResult> = {}): SkillResult {
  return {
    id: 100,
    content: 42,
    project: 1,
    skill_name: "relevance_scoring",
    status: "completed",
    result_data: { score: 0.82 },
    error_message: "",
    model_used: "gpt-5.4-mini",
    latency_ms: 150,
    confidence: 0.93,
    created_at: "2026-04-28T10:05:00Z",
    superseded_by: null,
    ...overrides,
  }
}

function createReviewQueueItem(
  overrides: Partial<ReviewQueueItem> = {},
): ReviewQueueItem {
  return {
    id: 9,
    project: 1,
    content: 42,
    reason: "borderline_relevance",
    confidence: 0.62,
    created_at: "2026-04-28T10:10:00Z",
    resolved: false,
    resolution: "",
    ...overrides,
  }
}

function createFeedback(overrides: Partial<UserFeedback> = {}): UserFeedback {
  return {
    id: 5,
    content: 42,
    project: 1,
    user: 3,
    feedback_type: "upvote",
    created_at: "2026-04-28T10:20:00Z",
    ...overrides,
  }
}

async function loadContentDetailModule() {
  return import("../page")
}

async function renderContentDetailPage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
  params: { id: string } = { id: "42" },
) {
  const { default: ContentDetailPage } = await loadContentDetailModule()

  return render(
    await ContentDetailPage({
      params: Promise.resolve(params),
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("deriveInitialPendingSkills", () => {
  it("returns only active relevance and summarization jobs", async () => {
    const { deriveInitialPendingSkills } = await loadContentDetailModule()

    expect(
      deriveInitialPendingSkills([
        createSkillResult({
          id: 1,
          skill_name: "relevance_scoring",
          status: "pending",
        }),
        createSkillResult({
          id: 2,
          skill_name: "summarization",
          status: "running",
        }),
        createSkillResult({
          id: 3,
          skill_name: "relevance_scoring",
          status: "completed",
        }),
        createSkillResult({
          id: 4,
          skill_name: "summarization",
          status: "failed",
        }),
        createSkillResult({
          id: 5,
          skill_name: "find_related",
          status: "pending",
        }),
        createSkillResult({
          id: 6,
          skill_name: "relevance_scoring",
          status: "pending",
          superseded_by: 99,
        }),
      ]),
    ).toEqual(["relevance_scoring", "summarization"])
  })
})

describe("ContentDetailPage", () => {
  beforeEach(() => {
    const defaultProject = createProject()
    const defaultContent = createContent()

    getProjectsMock.mockReset()
    getProjectContentMock.mockReset()
    getProjectSkillResultsMock.mockReset()
    getProjectReviewQueueMock.mockReset()
    getProjectFeedbackMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectContentMock.mockResolvedValue(defaultContent)
    getProjectSkillResultsMock.mockResolvedValue([])
    getProjectReviewQueueMock.mockResolvedValue([])
    getProjectFeedbackMock.mockResolvedValue([])
    selectProjectMock.mockImplementation((projects: Project[]) => {
      return projects[0] ?? null
    })
  })

  it("renders the no-project empty state and skips project-scoped API calls", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderContentDetailPage({}, { id: "42" })

    expect(selectProjectMock).toHaveBeenCalledWith([], {})
    expect(
      screen.getByText("No project is available for the configured API user."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Create a project first in Django admin."),
    ).toBeInTheDocument()
    expect(getProjectContentMock).not.toHaveBeenCalled()
    expect(getProjectSkillResultsMock).not.toHaveBeenCalled()
    expect(getProjectReviewQueueMock).not.toHaveBeenCalled()
    expect(getProjectFeedbackMock).not.toHaveBeenCalled()
  })

  it("renders flash messages and empty-state fallbacks for missing detail data", async () => {
    getProjectContentMock.mockResolvedValue(
      createContent({
        author: "",
        content_type: "",
        relevance_score: null,
      }),
    )

    await renderContentDetailPage({
      error: "Skill failed",
      message: "Feedback saved",
      project: "1",
    })

    expect(selectProjectMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      {
        error: "Skill failed",
        message: "Feedback saved",
        project: "1",
      },
    )
    expect(screen.getByText("Skill failed")).toBeInTheDocument()
    expect(screen.getByText("Feedback saved")).toBeInTheDocument()
    expect(screen.getByText("Unknown author")).toBeInTheDocument()
    expect(screen.getByText("unclassified")).toBeInTheDocument()
    expect(
      screen.getByText("No review flags are attached to this content."),
    ).toBeInTheDocument()

    const actionBar = screen.getByTestId("skill-action-bar")
    expect(actionBar).toHaveAttribute("data-can-summarize", "false")
    expect(actionBar).toHaveAttribute("data-pending-skills", "")

    const badges = screen.getAllByTestId("status-badge")
    expect(badges[0]).toHaveAttribute("data-tone", "warning")
    expect(badges[0]).toHaveTextContent("Relevance n/a")
  })

  it("renders filtered skill results, review items, feedback counts, and action-bar props", async () => {
    const selectedProject = createProject({ id: 3 })
    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectContentMock.mockResolvedValue(
      createContent({ id: 77, project: 3, relevance_score: 0.91 }),
    )
    getProjectSkillResultsMock.mockResolvedValue([
      createSkillResult({
        id: 1,
        content: 77,
        project: 3,
        skill_name: "relevance_scoring",
        status: "pending",
        model_used: "",
      }),
      createSkillResult({
        id: 2,
        content: 77,
        project: 3,
        skill_name: "summarization",
        status: "running",
        model_used: "",
      }),
      createSkillResult({
        id: 3,
        content: 77,
        project: 3,
        skill_name: "content_classification",
        status: "completed",
        model_used: "gpt-5.4-mini",
      }),
      createSkillResult({
        id: 4,
        content: 77,
        project: 3,
        skill_name: "find_related",
        status: "failed",
        model_used: "embed-model",
        error_message: "Index unavailable",
      }),
      createSkillResult({
        id: 5,
        content: 88,
        project: 3,
        skill_name: "relevance_scoring",
        status: "pending",
      }),
    ])
    getProjectReviewQueueMock.mockResolvedValue([
      createReviewQueueItem({
        id: 1,
        content: 77,
        project: 3,
        resolved: false,
        reason: "borderline_relevance",
      }),
      createReviewQueueItem({
        id: 2,
        content: 77,
        project: 3,
        reason: "low_confidence_classification",
        resolved: true,
        resolution: "human_approved",
      }),
      createReviewQueueItem({ id: 3, content: 88, project: 3 }),
    ])
    getProjectFeedbackMock.mockResolvedValue([
      createFeedback({ id: 1, content: 77, project: 3, feedback_type: "upvote" }),
      createFeedback({
        id: 2,
        content: 77,
        project: 3,
        feedback_type: "downvote",
      }),
      createFeedback({ id: 3, content: 88, project: 3, feedback_type: "upvote" }),
    ])

    await renderContentDetailPage({ project: "3" }, { id: "77" })

    expect(getProjectContentMock).toHaveBeenCalledWith(3, 77)
    expect(screen.getByText("1/1")).toBeInTheDocument()
    expect(screen.getByText("Awaiting human resolution")).toBeInTheDocument()
    expect(screen.getByText("human_approved")).toBeInTheDocument()
    expect(screen.getByText("Index unavailable")).toBeInTheDocument()
    expect(screen.getByText("gpt-5.4-mini")).toBeInTheDocument()
    expect(screen.getByText("embed-model")).toBeInTheDocument()

    const actionBar = screen.getByTestId("skill-action-bar")
    expect(actionBar).toHaveAttribute("data-project-id", "3")
    expect(actionBar).toHaveAttribute("data-content-id", "77")
    expect(actionBar).toHaveAttribute("data-can-summarize", "true")
    expect(actionBar).toHaveAttribute(
      "data-pending-skills",
      "relevance_scoring,summarization",
    )

    const badges = screen.getAllByTestId("status-badge")
    expect(badges[0]).toHaveAttribute("data-tone", "positive")
    expect(badges[0]).toHaveTextContent("Relevance 0.91")
    expect(badges[1]).toHaveAttribute("data-tone", "warning")
    expect(badges[1]).toHaveTextContent("model pending")
    expect(badges[2]).toHaveAttribute("data-tone", "warning")
    expect(badges[2]).toHaveTextContent("model pending")
    expect(badges[3]).toHaveAttribute("data-tone", "positive")
    expect(badges[3]).toHaveTextContent("gpt-5.4-mini")
    expect(badges[4]).toHaveAttribute("data-tone", "negative")
    expect(badges[4]).toHaveTextContent("embed-model")
    expect(badges[5]).toHaveAttribute("data-tone", "warning")
    expect(badges[5]).toHaveTextContent("borderline_relevance")
    expect(badges[6]).toHaveAttribute("data-tone", "neutral")
    expect(badges[6]).toHaveTextContent("low_confidence_classification")
  })
})