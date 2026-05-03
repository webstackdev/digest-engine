import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createPublicMembershipInvitation } from "@/lib/storybook-fixtures"

import { InvitePageContent } from "."

const meta = {
  title: "Pages/InviteToken/Components/InvitePageContent",
  component: InvitePageContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    token: "invite-token",
    invitation: createPublicMembershipInvitation(),
    isAuthenticated: false,
  },
} satisfies Meta<typeof InvitePageContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashAndSignedInUser: Story = {
  args: {
    isAuthenticated: true,
    successMessage: "Invitation is ready to accept.",
  },
}

export const FetchError: Story = {
  args: {
    invitation: null,
    invitationError: "Unable to load invitation.",
  },
}