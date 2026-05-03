import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { userEvent, within } from "storybook/test"

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { compactDocsParameters } from "@/lib/storybook-docs"

import { UserMenuContent } from "."

const meta = {
  title: "Layout/UserMenu/Components/UserMenuContent",
  component: UserMenuContent,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    accountName: "Taylor Swift",
    accountEmail: "taylor@example.com",
    avatarUrl: null,
    isAuthenticated: true,
  },
  render: (args) => (
    <div className="flex min-h-48 items-start justify-end p-6">
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Open user menu">Open</DropdownMenuTrigger>
        <UserMenuContent {...args} />
      </DropdownMenu>
    </div>
  ),
} satisfies Meta<typeof UserMenuContent>

export default meta

type Story = StoryObj<typeof meta>

export const Authenticated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open user menu" }))
  },
}

export const GuestFallback: Story = {
  args: {
    accountName: "Guest user",
    accountEmail: "",
    isAuthenticated: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("button", { name: "Open user menu" }))
  },
}
