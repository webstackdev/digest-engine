import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { TrendsFilterToolbar } from "."

const meta = {
  title: "Pages/Trends/Components/TrendsFilterToolbar",
  component: TrendsFilterToolbar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    availableSources: ["rss", "reddit", "bluesky"],
    sourceFilter: "",
    daysFilter: 14,
  },
} satisfies Meta<typeof TrendsFilterToolbar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filtered: Story = {
  args: {
    sourceFilter: "rss",
    daysFilter: 30,
  },
}