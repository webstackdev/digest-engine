import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { IdeasToolbarCard } from "."

const meta = {
  title: "Pages/Ideas/Components/IdeasToolbarCard",
  component: IdeasToolbarCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    statusFilter: "all",
    currentPageHref: "/ideas?project=1",
  },
} satisfies Meta<typeof IdeasToolbarCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filtered: Story = {
  args: {
    statusFilter: "accepted",
    currentPageHref: "/ideas?project=1&status=accepted",
  },
}
