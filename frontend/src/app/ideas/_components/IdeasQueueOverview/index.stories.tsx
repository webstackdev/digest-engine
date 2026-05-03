import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { IdeasQueueOverview } from "."

const meta = {
  title: "Pages/Ideas/Components/IdeasQueueOverview",
  component: IdeasQueueOverview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    pendingCount: 4,
    acceptedCount: 2,
    writtenCount: 1,
    dismissedCount: 1,
  },
} satisfies Meta<typeof IdeasQueueOverview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
