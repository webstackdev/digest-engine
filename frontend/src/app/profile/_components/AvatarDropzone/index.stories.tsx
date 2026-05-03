import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { AvatarDropzone } from "."

const meta = {
  title: "Pages/Profile/Components/AvatarDropzone",
  component: AvatarDropzone,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    isUploading: false,
    onUpload: async () => {},
  },
} satisfies Meta<typeof AvatarDropzone>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Uploading: Story = {
  args: {
    isUploading: true,
  },
}
