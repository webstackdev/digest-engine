import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createThemeSuggestion,
  createTopicCluster,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"

import { ThemeSuggestionCard } from "."

const baseCluster = createTopicCluster()
const baseClusterDetail = createTopicClusterDetail()

const meta = {
  title: "Pages/Themes/Components/ThemeSuggestionCard",
  component: ThemeSuggestionCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    theme: createThemeSuggestion(),
    projectId: 1,
    currentPageHref: "/themes?project=1",
    cluster: baseCluster,
    clusterDetail: baseClusterDetail,
  },
} satisfies Meta<typeof ThemeSuggestionCard>

export default meta

type Story = StoryObj<typeof meta>

export const Pending: Story = {}

export const AcceptedWithPromotedContent: Story = {
  args: {
    theme: createThemeSuggestion({
      status: "accepted",
      decided_at: "2026-04-29T08:00:00Z",
      decided_by: 4,
      decided_by_username: "editor-1",
      promoted_contents: [
        {
          id: 88,
          url: "https://example.com/promoted",
          title: "Promoted supporting article",
          published_date: "2026-04-28T06:00:00Z",
          source_plugin: "rss",
          newsletter_promotion_at: "2026-04-29T08:00:00Z",
        },
      ],
    }),
  },
}

export const Dismissed: Story = {
  args: {
    theme: createThemeSuggestion({
      status: "dismissed",
      dismissal_reason: "already covered",
      decided_at: "2026-04-29T08:00:00Z",
      decided_by: 4,
      decided_by_username: "editor-1",
    }),
  },
}
