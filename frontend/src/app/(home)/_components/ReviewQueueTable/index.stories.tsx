import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createContent } from "@/lib/storybook-fixtures"
import type { ReviewQueueItem } from "@/lib/types"

import { ReviewQueueTable } from "."

const content = createContent()
const pendingReviewItems: ReviewQueueItem[] = [
  {
    id: 7,
    project: 1,
    content: content.id,
    reason: "borderline_relevance",
    confidence: 0.61,
    created_at: "2026-04-28T12:00:00Z",
    resolved: false,
    resolution: "",
  },
]

const meta = {
  title: "Pages/Home/Components/ReviewQueueTable",
  component: ReviewQueueTable,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    pendingReviewItems,
    contentMap: new Map([[content.id, content]]),
  },
} satisfies Meta<typeof ReviewQueueTable>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    pendingReviewItems: [],
    contentMap: new Map(),
  },
}
