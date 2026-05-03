import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { UserAvatar } from "."

const meta = {
  title: "Elements/UserAvatar",
  component: UserAvatar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    name: "Ada Lovelace",
    size: "lg",
  },
} satisfies Meta<typeof UserAvatar>

export default meta

type Story = StoryObj<typeof meta>

export const InitialsFallback: Story = {}

export const WithAvatar: Story = {
  args: {
    avatarUrl: "https://example.com/avatar-thumb.png",
  },
}
