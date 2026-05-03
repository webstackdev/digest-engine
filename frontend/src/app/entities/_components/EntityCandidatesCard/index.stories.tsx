import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createEntity, createEntityCandidate } from "@/lib/storybook-fixtures"

import { EntityCandidatesCard } from "."

const meta = {
  title: "Pages/Entities/Components/EntityCandidatesCard",
  component: EntityCandidatesCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    entities: [
      createEntity({ id: 9, name: "Anthropic" }),
      createEntity({ id: 10, name: "OpenRouter" }),
    ],
    entityCandidates: [createEntityCandidate()],
    projectId: 1,
  },
} satisfies Meta<typeof EntityCandidatesCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    entityCandidates: [],
  },
}
