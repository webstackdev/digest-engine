import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createUserProfile } from "@/lib/storybook-fixtures"

import { ProfileForm } from "."

const meta = {
  title: "Pages/Profile/Components/ProfileForm",
  component: ProfileForm,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    profile: createUserProfile(),
    isSaving: false,
    onSave: async () => {},
  },
} satisfies Meta<typeof ProfileForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Saving: Story = {
  args: {
    isSaving: true,
  },
}
