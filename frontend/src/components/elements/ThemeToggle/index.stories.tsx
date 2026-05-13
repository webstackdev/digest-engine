import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { ThemeToggle } from "."

const meta = {
  title: "Elements/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: compactDocsParameters,
  },
} satisfies Meta<typeof ThemeToggle>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InToolbarRow: Story = {
  render: () => (
    <div className="flex items-center gap-3 rounded-2xl border border-trim-offset bg-page-base p-3">
      <span className="text-sm text-muted">Appearance</span>
      <ThemeToggle />
    </div>
  ),
}
