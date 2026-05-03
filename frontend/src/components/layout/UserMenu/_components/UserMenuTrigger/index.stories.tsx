import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { DropdownMenu } from "@/components/ui/dropdown-menu"
import { compactDocsParameters } from "@/lib/storybook-docs"

import { UserMenuTrigger } from "."

const meta = {
  title: "Layout/UserMenu/Components/UserMenuTrigger",
  component: UserMenuTrigger,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    accountName: "Taylor Swift",
    avatarUrl: null,
  },
  render: (args) => (
    <div className="p-6">
      <DropdownMenu>
        <UserMenuTrigger {...args} />
      </DropdownMenu>
    </div>
  ),
} satisfies Meta<typeof UserMenuTrigger>

export default meta

type Story = StoryObj<typeof meta>

export const InitialsFallback: Story = {}

export const WithAvatar: Story = {
  args: {
    avatarUrl: "https://images.example.com/avatar-thumb.jpg",
  },
}
