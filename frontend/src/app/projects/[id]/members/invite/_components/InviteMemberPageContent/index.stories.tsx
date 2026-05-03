import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject } from "@/lib/storybook-fixtures"

import { InviteMemberPageContent } from "."

const meta = {
  title: "Pages/ProjectMemberInvite/Components/InviteMemberPageContent",
  component: InviteMemberPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projects: [createProject()],
    selectedProject: createProject(),
  },
} satisfies Meta<typeof InviteMemberPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashMessages: Story = {
  args: {
    errorMessage: "Unable to send invitation.",
    successMessage: "Invitation sent.",
  },
}