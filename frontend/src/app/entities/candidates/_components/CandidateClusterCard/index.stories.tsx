import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createEntity, createEntityCandidate } from "@/lib/storybook-fixtures"

import { groupCandidateClusters } from "../shared"
import { CandidateClusterCard } from "."

const cluster = groupCandidateClusters([
  createEntityCandidate(),
  createEntityCandidate({
    id: 15,
    name: "River Labs AI",
    occurrence_count: 4,
    evidence_count: 4,
  }),
])[0]

const meta = {
  title: "Pages/EntityCandidates/Components/CandidateClusterCard",
  component: CandidateClusterCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    cluster,
    entities: [
      createEntity({ id: 7, name: "OpenAI" }),
      createEntity({ id: 8, name: "Anthropic", type: "organization" }),
    ],
    selectedProjectId: 1,
  },
} satisfies Meta<typeof CandidateClusterCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
