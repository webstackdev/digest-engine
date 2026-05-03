import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { TrendsPageContent } from "@/app/trends/_components/TrendsPageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createContent,
  createProject,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"

const content = createContent()
const populatedClusters = [
  createTopicClusterDetail(),
  createTopicClusterDetail({
    id: 6,
    label: "Operational Guardrails",
    member_count: 2,
    velocity_score: 0.58,
    z_score: 1.12,
  }),
]

const meta = {
  title: "Pages/Trends",
  component: TrendsPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projects: [createProject()],
    selectedProject: createProject(),
    filteredClusterDetails: populatedClusters,
    selectedCluster: populatedClusters[0] ?? null,
    contentMap: new Map([[content.id, content]]),
    availableSources: ["rss", "reddit"],
    sourceFilter: "",
    daysFilter: 14,
    averageVelocityScore: 0.7,
  },
} satisfies Meta<typeof TrendsPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {}

export const Empty: Story = {
  args: {
    filteredClusterDetails: [],
    selectedCluster: null,
  },
}

export const WithFlashMessages: Story = {
  args: {
    errorMessage: "Unable to refresh trends.",
    successMessage: "Trend filters applied.",
  },
}
