import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { DashboardFilterToolbar } from "."

const meta = {
  title: "Pages/Home/Components/DashboardFilterToolbar",
  component: DashboardFilterToolbar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    view: "content",
    contentTypes: ["article", "tutorial"],
    contentTypeFilter: "",
    sources: ["rss", "reddit"],
    sourceFilter: "",
    daysFilter: 30,
    duplicateStateFilter: "",
  },
} satisfies Meta<typeof DashboardFilterToolbar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filtered: Story = {
  args: {
    contentTypeFilter: "article",
    sourceFilter: "rss",
    duplicateStateFilter: "duplicate_related",
  },
}
