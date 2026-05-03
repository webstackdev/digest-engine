import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject } from "@/lib/storybook-fixtures"

import { AppShellSidebar } from "."

const projects = [
  createProject(),
  createProject({
    id: 2,
    name: "Platform Weekly",
    topic_description: "Platform engineering",
    user_role: "member",
  }),
]

const meta = {
  title: "Layout/AppShell/Components/AppShellSidebar",
  component: AppShellSidebar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
    layout: "fullscreen",
  },
  args: {
    projects,
    selectedProjectId: 1,
    projectQuery: "?project=1",
    canManageMembers: true,
  },
} satisfies Meta<typeof AppShellSidebar>

export default meta

type Story = StoryObj<typeof meta>

export const AdminProjectSelected: Story = {}

export const MemberProjectSelected: Story = {
  args: {
    selectedProjectId: 2,
    projectQuery: "?project=2",
    canManageMembers: false,
  },
}