import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { InvitePageContent } from "@/app/invite/[token]/_components/InvitePageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { createPublicMembershipInvitation } from "@/lib/storybook-fixtures"

type InvitePagePreviewProps = {
  invitation?: ReturnType<typeof createPublicMembershipInvitation> | null
  isAuthenticated?: boolean
  errorMessage?: string
  successMessage?: string
  invitationError?: string
}

const meta = {
  title: "Pages/InviteToken",
  component: InvitePagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    invitation: createPublicMembershipInvitation(),
    isAuthenticated: false,
  },
} satisfies Meta<typeof InvitePagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const SignedOutPending: Story = {}

export const SignedInPending: Story = {
  args: {
    isAuthenticated: true,
  },
}

export const FetchError: Story = {
  args: {
    invitation: null,
    invitationError: "Unable to load invitation.",
  },
}

function InvitePagePreview({
  invitation = createPublicMembershipInvitation(),
  isAuthenticated = false,
  errorMessage,
  successMessage,
  invitationError,
}: InvitePagePreviewProps) {
  return (
    <InvitePageContent
      errorMessage={errorMessage}
      invitation={invitation}
      invitationError={invitationError}
      isAuthenticated={isAuthenticated}
      successMessage={successMessage}
      token="invite-token"
    />
  )
}