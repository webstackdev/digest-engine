import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createPublicMembershipInvitation } from "@/lib/storybook-fixtures"

import { InvitationDetailsCard } from "."

const meta = {
  title: "Pages/InviteToken/Components/InvitationDetailsCard",
  component: InvitationDetailsCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    invitation: createPublicMembershipInvitation(),
    token: "invite-token",
    isAuthenticated: false,
  },
} satisfies Meta<typeof InvitationDetailsCard>

export default meta

type Story = StoryObj<typeof meta>

export const SignedOutPending: Story = {}

export const SignedInPending: Story = {
  args: {
    isAuthenticated: true,
  },
}

export const Accepted: Story = {
  args: {
    invitation: createPublicMembershipInvitation({ status: "accepted" }),
    isAuthenticated: true,
  },
}

export const Revoked: Story = {
  args: {
    invitation: createPublicMembershipInvitation({ status: "revoked" }),
  },
}
