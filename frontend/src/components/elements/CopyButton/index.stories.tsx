import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { CopyButton } from "."

const meta = {
  title: "UI/CopyButton",
  component: CopyButton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: compactDocsParameters,
  },
  args: {
    label: "Copy invite link",
    value: "https://example.com/invite/abc123",
  },
} satisfies Meta<typeof CopyButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CompactToolbar: Story = {
  render: (args: ComponentProps<typeof CopyButton>) => (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-panel backdrop-blur-xl">
      <span className="text-sm text-muted">Share</span>
      <CopyButton {...args} />
    </div>
  ),
}
