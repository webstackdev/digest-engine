import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createProject,
  createThemeSuggestion,
  createTopicCluster,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"

import { ThemesPageContent } from "."

const meta = {
  title: "Pages/Themes/Components/ThemesPageContent",
  component: ThemesPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projects: [createProject()],
    selectedProject: createProject(),
    themes: [
      createThemeSuggestion(),
      createThemeSuggestion({
        id: 8,
        status: "accepted",
        decided_at: "2026-04-29T08:00:00Z",
        decided_by: 4,
        decided_by_username: "editor-1",
      }),
    ],
    clusters: [createTopicCluster()],
    clusterDetails: [createTopicClusterDetail()],
    statusFilter: "all",
    selectedThemeId: 0,
  },
} satisfies Meta<typeof ThemesPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashMessages: Story = {
  args: {
    errorMessage: "Unable to update theme.",
    successMessage: "Theme updated.",
  },
}
