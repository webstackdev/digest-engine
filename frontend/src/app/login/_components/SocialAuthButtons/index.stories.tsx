import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import SocialAuthButtons from "."

const meta = {
  title: "Pages/Login/Components/SocialAuthButtons",
  component: SocialAuthButtons,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    callbackUrl: "/entities?project=2",
  },
} satisfies Meta<typeof SocialAuthButtons>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}