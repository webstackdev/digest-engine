import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createContent } from "@/lib/storybook-fixtures"

import { ContentFeed } from "."

const content = createContent({
  is_reference: true,
  newsletter_promotion_at: "2026-04-28T11:00:00Z",
  newsletter_promotion_theme: 14,
})

const meta = {
  title: "Pages/Home/Components/ContentFeed",
  component: ContentFeed,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
    filteredContents: [content],
    contentClusterLookup: new Map([
      [content.id, { clusterId: 5, label: "Platform Signals", velocityScore: 0.81 }],
    ]),
  },
} satisfies Meta<typeof ContentFeed>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    filteredContents: [],
    contentClusterLookup: new Map(),
  },
}
