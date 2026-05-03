import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { ThemesFilterToolbar } from "."

const meta = {
  title: "Pages/Themes/Components/ThemesFilterToolbar",
  component: ThemesFilterToolbar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    statusFilter: "all",
  },
} satisfies Meta<typeof ThemesFilterToolbar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Pending: Story = {
  args: {
    statusFilter: "pending",
  },
}
