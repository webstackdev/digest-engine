import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { ThemesQueueOverview } from "."

const meta = {
  title: "Pages/Themes/Components/ThemesQueueOverview",
  component: ThemesQueueOverview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    pendingCount: 4,
    acceptedCount: 3,
    dismissedCount: 1,
    totalCount: 8,
  },
} satisfies Meta<typeof ThemesQueueOverview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
