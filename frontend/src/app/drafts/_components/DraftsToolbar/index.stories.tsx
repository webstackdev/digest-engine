import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { DraftsToolbar } from "."

const meta = {
  title: "Pages/Drafts/Components/DraftsToolbar",
  component: DraftsToolbar,
  tags: ["autodocs"],
  parameters: { docs: compactDocsParameters },
  args: {
    currentPageHref: "/drafts?project=1&status=ready",
    selectedProjectId: 1,
    statusFilter: "ready",
  },
} satisfies Meta<typeof DraftsToolbar>

export default meta

type Story = StoryObj<typeof meta>

export const ReadyFilter: Story = {}

export const AllDrafts: Story = {
  args: {
    currentPageHref: "/drafts?project=1",
    statusFilter: "all",
  },
}
