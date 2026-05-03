import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { TrendsQueueOverview } from "."

const meta = {
  title: "Pages/Trends/Components/TrendsQueueOverview",
  component: TrendsQueueOverview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    visibleClusterCount: 4,
    averageVelocityScore: 0.61,
    daysFilter: 14,
    contentCount: 27,
  },
} satisfies Meta<typeof TrendsQueueOverview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
