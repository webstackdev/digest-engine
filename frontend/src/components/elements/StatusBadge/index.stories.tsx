import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { StatusBadge } from "."

const meta = {
  title: "Elements/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    children: "Healthy",
    tone: "positive",
  },
  argTypes: {
    tone: {
      control: "radio",
      options: ["positive", "warning", "negative", "neutral"],
    },
  },
} satisfies Meta<typeof StatusBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Positive: Story = {}

export const Warning: Story = {
  args: {
    tone: "warning",
    children: "Needs attention",
  },
}

export const Negative: Story = {
  args: {
    tone: "negative",
    children: "Failed",
  },
}

export const Neutral: Story = {
  args: {
    tone: "neutral",
    children: "Idle",
  },
}

export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusBadge tone="positive">Healthy</StatusBadge>
      <StatusBadge tone="warning">Queued</StatusBadge>
      <StatusBadge tone="negative">Error</StatusBadge>
      <StatusBadge tone="neutral">Idle</StatusBadge>
    </div>
  ),
}
