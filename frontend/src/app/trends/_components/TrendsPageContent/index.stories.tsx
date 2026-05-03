import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createContent,
  createProject,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"

import { TrendsPageContent } from "."

const content = createContent()
const selectedCluster = createTopicClusterDetail()
const populatedClusters = [
  selectedCluster,
  createTopicClusterDetail({
    id: 6,
    label: "Operational Guardrails",
    member_count: 2,
    velocity_score: 0.58,
    z_score: 1.12,
  }),
]

const meta = {
  title: "Pages/Trends/Components/TrendsPageContent",
  component: TrendsPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projects: [createProject()],
    selectedProject: createProject(),
    filteredClusterDetails: populatedClusters,
    selectedCluster,
    contentMap: new Map([[content.id, content]]),
    availableSources: ["rss", "reddit"],
    sourceFilter: "",
    daysFilter: 14,
    averageVelocityScore: 0.7,
  },
} satisfies Meta<typeof TrendsPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    filteredClusterDetails: [],
    selectedCluster: null,
  },
}
