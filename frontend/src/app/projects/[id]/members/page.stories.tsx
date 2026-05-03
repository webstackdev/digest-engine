import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { MembersPageContent } from "@/app/projects/[id]/members/_components/MembersPageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createMembershipInvitation,
  createProject,
  createProjectMembership,
} from "@/lib/storybook-fixtures"

const meta = {
  title: "Pages/ProjectMembers",
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
    invitations: [
      createMembershipInvitation(),
      createMembershipInvitation({
        id: 10,
        email: "accepted@example.com",
        accepted_at: "2026-04-29T14:00:00Z",
      }),
    ],
  },
} satisfies Meta<typeof MembersPageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashMessages: Story = {
  args: {
    successMessage: "Member updated.",
    errorMessage: "Unable to revoke invitation.",
  },
}
