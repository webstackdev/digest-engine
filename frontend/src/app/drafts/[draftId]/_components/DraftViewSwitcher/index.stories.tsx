import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { DraftViewSwitcher } from "."

const meta = {
  title: "Pages/DraftDetail/Components/DraftViewSwitcher",
  component: DraftViewSwitcher,
  tags: ["autodocs"],
  parameters: { docs: compactDocsParameters },
  args: {
    currentView: "editor",
    draftId: 8,
    selectedProjectId: 1,
  },
} satisfies Meta<typeof DraftViewSwitcher>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Markdown: Story = {
  args: {
    currentView: "markdown",
  },
}