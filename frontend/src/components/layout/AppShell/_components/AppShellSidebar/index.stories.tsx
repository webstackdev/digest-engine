import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject } from "@/lib/storybook-fixtures"
import type { MessageThread } from "@/lib/types"

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

const initialMessageThreads: MessageThread[] = [
  {
    id: 1,
    counterpart: null,
    has_unread: true,
    last_message_preview: "Draft ready",
    last_message_at: "2026-05-03T10:00:00Z",
    last_read_at: null,
    created_at: "2026-05-01T10:00:00Z",
  },
  {
    id: 2,
    counterpart: null,
    has_unread: false,
    last_message_preview: "Looks good",
    last_message_at: "2026-05-03T09:30:00Z",
    last_read_at: "2026-05-03T09:31:00Z",
    created_at: "2026-05-01T09:00:00Z",
  },
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
    initialMessageThreads,
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
