import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import LoginPageContent from "@/app/login/_components/LoginPageContent"
import { compactDocsParameters } from "@/lib/storybook-docs"

type LoginPagePreviewProps = {
  callbackUrl?: string
}

const meta = {
  title: "Pages/Login",
  component: LoginPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    callbackUrl: "/entities?project=2",
  },
} satisfies Meta<typeof LoginPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InviteCallback: Story = {
  args: {
    callbackUrl: "/invite/invite-token",
  },
}

function LoginPagePreview({ callbackUrl = "/" }: LoginPagePreviewProps) {
  return <LoginPageContent callbackUrl={callbackUrl} />
}
