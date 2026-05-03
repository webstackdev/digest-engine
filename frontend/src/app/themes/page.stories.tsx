import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { ThemesPageContent } from "@/app/themes/_components/ThemesPageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createProject,
  createThemeSuggestion,
  createTopicCluster,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"

const populatedThemes = [
  createThemeSuggestion(),
  createThemeSuggestion({
    id: 8,
    status: "accepted",
    decided_at: "2026-04-29T08:00:00Z",
    decided_by: 4,
    decided_by_username: "editor-1",
    promoted_contents: [
      {
        id: 77,
        url: "https://example.com/promoted",
        title: "Accepted supporting article",
        published_date: "2026-04-28T05:00:00Z",
        source_plugin: "rss",
        newsletter_promotion_at: "2026-04-29T08:00:00Z",
      },
    ],
  }),
  createThemeSuggestion({
    id: 9,
    status: "dismissed",
    dismissal_reason: "already covered",
  }),
]

const meta = {
  title: "Pages/Themes",
  component: ThemesPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projects: [createProject()],
    selectedProject: createProject(),
    themes: populatedThemes,
    clusters: [createTopicCluster()],
    clusterDetails: [createTopicClusterDetail()],
    statusFilter: "all",
    selectedThemeId: 0,
  },
} satisfies Meta<typeof ThemesPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: {
    themes: [],
  },
}

export const WithFlashMessages: Story = {
  args: {
    errorMessage: "Unable to update theme.",
    successMessage: "Theme updated.",
  },
}
