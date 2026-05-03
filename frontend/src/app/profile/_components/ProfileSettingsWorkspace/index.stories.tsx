import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createUserProfile } from "@/lib/storybook-fixtures"

import { ProfileSettingsWorkspace } from "."

const meta = {
  title: "Pages/Profile/Components/ProfileSettingsWorkspace",
  component: ProfileSettingsWorkspace,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    notice: null,
    profile: createUserProfile(),
    isSaving: false,
    isUploading: false,
    isRemoving: false,
    onSave: async () => {},
    onUpload: async () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof ProfileSettingsWorkspace>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithErrorNotice: Story = {
  args: {
    notice: {
      message: "Unable to upload avatar.",
      tone: "error",
    },
  },
}