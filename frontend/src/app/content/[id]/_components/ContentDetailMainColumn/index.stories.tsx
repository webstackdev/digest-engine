import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createContent } from "@/lib/storybook-fixtures"
import type { SkillResult } from "@/lib/types"

import { ContentDetailMainColumn } from "."

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

const meta = {
  title: "Pages/ContentDetail/Components/ContentDetailMainColumn",
  component: ContentDetailMainColumn,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    canSummarize: true,
    content: createContent({ relevance_score: 0.64, authority_adjusted_score: 0.91 }),
    contentSkillResults: [
      createSkillResult({ id: 1, status: "pending", model_used: "" }),
      createSkillResult({
        id: 2,
        skill_name: "find_related",
        status: "failed",
        model_used: "embed-model",
        error_message: "Index unavailable",
      }),
    ],
    effectiveRelevanceScore: 0.91,
    initialPendingSkills: ["relevance_scoring", "summarization"],
    selectedProjectId: 1,
  },
} satisfies Meta<typeof ContentDetailMainColumn>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Minimal: Story = {
  args: {
    canSummarize: false,
    content: createContent({
      author: "",
      content_type: "",
      relevance_score: null,
      authority_adjusted_score: null,
    }),
    contentSkillResults: [],
    effectiveRelevanceScore: null,
    initialPendingSkills: [],
  },
}
