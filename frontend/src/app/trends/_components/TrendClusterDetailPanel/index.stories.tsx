import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createContent, createTopicClusterDetail } from "@/lib/storybook-fixtures"

import { TrendClusterDetailPanel } from "."

const content = createContent()
const selectedCluster = createTopicClusterDetail()

const meta = {
  title: "Pages/Trends/Components/TrendClusterDetailPanel",
  component: TrendClusterDetailPanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    selectedCluster,
    contentMap: new Map([[content.id, content]]),
  },
} satisfies Meta<typeof TrendClusterDetailPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    selectedCluster: null,
    contentMap: new Map(),
  },
}
