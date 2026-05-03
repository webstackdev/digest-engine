import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createContent,
  createEntity,
  createProject,
  createSourceConfig,
} from "@/lib/storybook-fixtures"
import type { ReviewQueueItem } from "@/lib/types"

import { HomePageContent } from "."

const content = createContent({
  is_reference: true,
  newsletter_promotion_at: "2026-04-28T11:00:00Z",
  newsletter_promotion_theme: 14,
})
const reviewItem: ReviewQueueItem = {
  id: 7,
  project: 1,
  content: content.id,
  reason: "borderline_relevance",
  confidence: 0.61,
  created_at: "2026-04-28T12:00:00Z",
  resolved: false,
  resolution: "",
}

const meta = {
  title: "Pages/Home/Components/HomePageContent",
  component: HomePageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projects: [createProject()],
    selectedProject: createProject(),
    filteredContents: [content],
    pendingReviewItems: [reviewItem],
    entities: [createEntity()],
    positiveFeedback: 1,
    negativeFeedback: 1,
    contentTypes: ["article"],
    contentTypeFilter: "",
    sources: ["rss"],
    sourceFilter: "",
    daysFilter: 30,
    duplicateStateFilter: "",
    view: "content",
    sourceConfigs: [createSourceConfig()],
    contentMap: new Map([[content.id, content]]),
    contentClusterLookup: new Map([[content.id, { clusterId: 5, label: "Platform Signals", velocityScore: 0.81 }]]),
  },
} satisfies Meta<typeof HomePageContent>

export default meta

type Story = StoryObj<typeof meta>

export const ContentView: Story = {}

export const ReviewView: Story = {
  args: {
    view: "review",
  },
}
