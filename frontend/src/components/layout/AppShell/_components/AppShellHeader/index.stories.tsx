import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { AppShellHeader } from "."

const meta = {
  title: "Layout/AppShell/Components/AppShellHeader",
  component: AppShellHeader,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    messagesHref: "/messages?project=1",
    title: "Trend analysis",
    description:
      "Cluster velocity, member content, and editorial context for the topics accelerating inside this project.",
  },
} satisfies Meta<typeof AppShellHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
