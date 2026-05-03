import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject, createSourceConfig } from "@/lib/storybook-fixtures"

import { DashboardSidebar } from "."

const meta = {
  title: "Pages/Home/Components/DashboardSidebar",
  component: DashboardSidebar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    selectedProject: createProject(),
    sourceConfigs: [createSourceConfig(), createSourceConfig({ id: 3, is_active: false })],
    pendingReviewCount: 4,
  },
} satisfies Meta<typeof DashboardSidebar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
