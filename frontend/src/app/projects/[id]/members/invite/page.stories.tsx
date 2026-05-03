import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { InviteMemberPageContent } from "@/app/projects/[id]/members/invite/_components/InviteMemberPageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProject } from "@/lib/storybook-fixtures"

const meta = {
  title: "Pages/ProjectMemberInvite",
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
    successMessage: "Invitation sent.",
    errorMessage: "Unable to send invitation.",
  },
}
