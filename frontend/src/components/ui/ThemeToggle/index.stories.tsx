import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { ThemeToggle } from "."

const meta = {
  title: "UI/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof ThemeToggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InToolbarRow: Story = {
  render: () => (
    <div className="flex items-center gap-3 rounded-2xl border border-border/12 bg-card/85 p-3">
      <span className="text-sm text-muted">Appearance</span>
      <ThemeToggle />
    </div>
  ),
}