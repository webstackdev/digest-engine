import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { createProject } from "@/lib/storybook-fixtures"

import { AppShell } from "./app-shell"

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
  title: "Components/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  args: {
    title: "Trend analysis",
    description: "Cluster velocity, member content, and editorial context for the topics accelerating inside this project.",
    projects,
    selectedProjectId: 1,
    children: (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Visible clusters</p>
          <p className="mt-1 text-3xl font-bold">4</p>
          <p className="text-sm leading-6 text-muted">Representative dashboard chrome for Storybook review.</p>
        </div>
        <div className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Recent activity</p>
          <p className="mt-1 text-3xl font-bold">12</p>
          <p className="text-sm leading-6 text-muted">Use this story to check navigation, project switching, and header behavior.</p>
        </div>
      </div>
    ),
  },
} satisfies Meta<typeof AppShell>

export default meta

type Story = StoryObj<typeof meta>

export const AdminProjectSelected: Story = {}

export const MemberProjectSelected: Story = {
  args: {
    selectedProjectId: 2,
    title: "Ideas queue",
    description: "Review original-content ideas without the members management affordance.",
  },
}