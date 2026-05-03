import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createMembershipInvitation } from "@/lib/storybook-fixtures"

import { InvitationsCard } from "."

const meta = {
  title: "Pages/ProjectMembers/Components/InvitationsCard",
  component: InvitationsCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    redirectTarget: "/projects/1/members?project=1",
    invitations: [
      createMembershipInvitation(),
      createMembershipInvitation({
        id: 9,
        email: "accepted@example.com",
        accepted_at: "2026-04-29T14:00:00Z",
      }),
      createMembershipInvitation({
        id: 10,
        email: "revoked@example.com",
        revoked_at: "2026-04-30T14:00:00Z",
      }),
    ],
  },
} satisfies Meta<typeof InvitationsCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    invitations: [],
  },
}