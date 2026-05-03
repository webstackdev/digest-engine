import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { DashboardOverview } from "."

const meta = {
  title: "Pages/Home/Components/DashboardOverview",
  component: DashboardOverview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    surfacedCount: 12,
    reviewQueueCount: 4,
    trackedEntitiesCount: 8,
    positiveFeedback: 5,
    negativeFeedback: 2,
  },
} satisfies Meta<typeof DashboardOverview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
