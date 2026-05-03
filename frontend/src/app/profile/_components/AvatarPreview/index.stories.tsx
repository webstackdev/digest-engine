import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createUserProfile } from "@/lib/storybook-fixtures"

import { AvatarPreview } from "."

const meta = {
  title: "Pages/Profile/Components/AvatarPreview",
  component: AvatarPreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    profile: createUserProfile(),
    isRemoving: false,
    onRemove: () => {},
  },
} satisfies Meta<typeof AvatarPreview>

export default meta

type Story = StoryObj<typeof meta>

export const InitialsFallback: Story = {}

export const WithAvatar: Story = {
  args: {
    profile: createUserProfile({
      avatar_url: "https://example.com/avatar.png",
      avatar_thumbnail_url: "https://example.com/avatar-thumb.png",
    }),
  },
}
