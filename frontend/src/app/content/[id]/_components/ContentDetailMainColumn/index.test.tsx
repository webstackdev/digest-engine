import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import type { Content, SkillResult } from "@/lib/types"

import { ContentDetailMainColumn } from "."

vi.mock("@/app/content/[id]/_components/SkillActionBar", () => ({
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
      data-can-summarize={canSummarize ? "true" : "false"}
      data-content-id={contentId}
      data-pending-skills={initialPendingSkills.join(",")}
      data-project-id={projectId}
      data-testid="skill-action-bar"
    />
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
    canonical_url: "https://example.com/article",
    published_date: "2026-04-28T09:00:00Z",
    ingested_at: "2026-04-28T10:00:00Z",
    content_text: "Body copy",
    relevance_score: 0.64,
    authority_adjusted_score: 0.91,
    embedding_id: "embed-1",
    duplicate_of: null,
    duplicate_signal_count: 0,
    is_reference: false,
    is_active: true,
    newsletter_promotion_at: null,
    newsletter_promotion_by: null,
    newsletter_promotion_theme: null,
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

describe("ContentDetailMainColumn", () => {
  it("renders article metadata, action-bar props, and skill result cards", () => {
    render(
      <ContentDetailMainColumn
        canSummarize
        content={createContent({ duplicate_of: 12, duplicate_signal_count: 2 })}
        contentSkillResults={[
          createSkillResult({ id: 1, status: "pending", model_used: "" }),
          createSkillResult({
            id: 2,
            skill_name: "find_related",
            status: "failed",
            model_used: "embed-model",
            error_message: "Index unavailable",
          }),
        ]}
        effectiveRelevanceScore={0.91}
        initialPendingSkills={["relevance_scoring", "summarization"]}
        selectedProjectId={3}
      />,
    )

    expect(screen.getByText("Important AI update")).toBeInTheDocument()
    expect(screen.getByText("Base 64%")).toBeInTheDocument()
    expect(screen.getByText("Also seen in 2 sources")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Duplicate of #12" })).toHaveAttribute(
      "href",
      "/content/12?project=3",
    )
    expect(screen.getByTestId("skill-action-bar")).toHaveAttribute(
      "data-pending-skills",
      "relevance_scoring,summarization",
    )
    expect(screen.getByText("Index unavailable")).toBeInTheDocument()
    expect(screen.getByText("embed-model")).toBeInTheDocument()

    const badges = screen.getAllByTestId("status-badge")
    expect(badges[0]).toHaveTextContent("Adjusted 91%")
    expect(badges[1]).toHaveTextContent("model pending")
    expect(badges[2]).toHaveTextContent("embed-model")
  })

  it("renders author and classification fallbacks", () => {
    render(
      <ContentDetailMainColumn
        canSummarize={false}
        content={createContent({
          author: "",
          content_type: "",
          relevance_score: null,
          authority_adjusted_score: null,
        })}
        contentSkillResults={[]}
        effectiveRelevanceScore={null}
        initialPendingSkills={[]}
        selectedProjectId={1}
      />,
    )

    expect(screen.getByText("Unknown author")).toBeInTheDocument()
    expect(screen.getByText("unclassified")).toBeInTheDocument()
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Adjusted n/a")
  })
})