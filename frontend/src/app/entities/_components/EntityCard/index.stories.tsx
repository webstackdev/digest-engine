import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createEntity } from "@/lib/storybook-fixtures"

import { EntityCard } from "."

const meta = {
  title: "Pages/Entities/Components/EntityCard",
  component: EntityCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    entity: createEntity(),
    projectId: 1,
  },
} satisfies Meta<typeof EntityCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoMentions: Story = {
  args: {
    entity: createEntity({
      latest_mentions: [],
      mention_count: 0,
    }),
  },
}
