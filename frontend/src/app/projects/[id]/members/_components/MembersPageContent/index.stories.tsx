import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createMembershipInvitation,
  createProject,
  createProjectMembership,
} from "@/lib/storybook-fixtures"

import { MembersPageContent } from "."

const meta = {
  title: "Pages/ProjectMembers/Components/MembersPageContent",
  component: MembersPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    currentUserId: 99,
    projects: [createProject()],
    selectedProject: createProject(),
    memberships: [
      createProjectMembership(),
      createProjectMembership({
        id: 7,
        username: "grace",
        email: "grace@example.com",
        display_name: "Grace Hopper",
        role: "member",
      }),
    ],
    invitations: [createMembershipInvitation()],
  },
} satisfies Meta<typeof MembersPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashMessages: Story = {
  args: {
    successMessage: "Invitation revoked.",
    errorMessage: "Unable to remove member.",
  },
}
