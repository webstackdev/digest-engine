import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { CandidateQueueOverview } from "."

const meta = {
  title: "Pages/EntityCandidates/Components/CandidateQueueOverview",
  component: CandidateQueueOverview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    activeTab: "review",
    clusterCount: 3,
    pendingCount: 5,
    resolvedCount: 2,
    selectedProjectId: 1,
  },
} satisfies Meta<typeof CandidateQueueOverview>

export default meta

type Story = StoryObj<typeof meta>

export const Review: Story = {}

export const AutoLog: Story = {
  args: {
    activeTab: "auto-log",
  },
}
