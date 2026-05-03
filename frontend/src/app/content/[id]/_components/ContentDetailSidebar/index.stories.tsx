import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createContent } from "@/lib/storybook-fixtures"
import type { ReviewQueueItem } from "@/lib/types"

import { ContentDetailSidebar } from "."

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
  title: "Pages/ContentDetail/Components/ContentDetailSidebar",
  component: ContentDetailSidebar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    content: createContent({
      newsletter_promotion_at: "2026-04-28T12:00:00Z",
      newsletter_promotion_by: 6,
      newsletter_promotion_theme: 14,
    }),
    downvotes: 1,
    reviewItems: [
      createReviewQueueItem(),
      createReviewQueueItem({
        id: 10,
        reason: "low_confidence_classification",
        resolved: true,
        resolution: "human_approved",
      }),
    ],
    selectedProjectId: 1,
    upvotes: 2,
  },
} satisfies Meta<typeof ContentDetailSidebar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    content: createContent(),
    downvotes: 0,
    reviewItems: [],
    upvotes: 0,
  },
}
