import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { ContentDetailMainColumn } from "@/app/content/[id]/_components/ContentDetailMainColumn"
import { ContentDetailSidebar } from "@/app/content/[id]/_components/ContentDetailSidebar"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { createContent, createProject } from "@/lib/storybook-fixtures"
import type { ReviewQueueItem, SkillResult } from "@/lib/types"

type ContentDetailPagePreviewProps = {
  showError?: boolean
  showMessage?: boolean
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

const meta = {
  title: "Pages/ContentDetail",
  component: ContentDetailPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof ContentDetailPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashes: Story = {
  args: {
    showError: true,
    showMessage: true,
  },
}

function ContentDetailPagePreview({
  showError = false,
  showMessage = false,
}: ContentDetailPagePreviewProps) {
  const selectedProject = createProject({ id: 1 })
  const content = createContent({
    relevance_score: 0.64,
    authority_adjusted_score: 0.91,
    newsletter_promotion_at: "2026-04-28T12:00:00Z",
    newsletter_promotion_by: 6,
    newsletter_promotion_theme: 14,
  })

  return (
    <AppShell
      title="Content detail"
      description="Inspect the raw article, persisted skill outputs, and editorial status for a single content item."
      projects={[selectedProject]}
      selectedProjectId={selectedProject.id}
    >
      {showError ? (
        <Alert
          className="rounded-3xl border-destructive bg-destructive"
          variant="destructive"
        >
          <AlertDescription className="text-destructive">
            Skill failed
          </AlertDescription>
        </Alert>
      ) : null}
      {showMessage ? (
        <Alert className="rounded-3xl border-trim-offset bg-muted">
          <AlertDescription>Feedback saved</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
        <ContentDetailMainColumn
          canSummarize
          content={content}
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
          selectedProjectId={selectedProject.id}
        />
        <ContentDetailSidebar
          content={content}
          downvotes={1}
          reviewItems={[
            createReviewQueueItem(),
            createReviewQueueItem({
              id: 10,
              reason: "low_confidence_classification",
              resolved: true,
              resolution: "human_approved",
            }),
          ]}
          selectedProjectId={selectedProject.id}
          upvotes={2}
        />
      </section>
    </AppShell>
  )
}
