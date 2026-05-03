import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createEntityMentionSummary } from "@/lib/storybook-fixtures"

import { EntityMentionsPanel } from "."

const meta = {
  title: "Pages/EntityDetail/Components/EntityMentionsPanel",
  component: EntityMentionsPanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    mentions: [
      createEntityMentionSummary(),
      createEntityMentionSummary({
        id: 32,
        content_id: 23,
        content_title: "Platform teams discuss Anthropic",
        role: "mentioned",
        sentiment: "neutral",
        confidence: 0.76,
      }),
    ],
    projectId: 1,
  },
} satisfies Meta<typeof EntityMentionsPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    mentions: [],
  },
}
