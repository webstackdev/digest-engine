import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createEntityCandidate } from "@/lib/storybook-fixtures"

import { ResolvedCandidateList } from "."

const meta = {
  title: "Pages/EntityCandidates/Components/ResolvedCandidateList",
  component: ResolvedCandidateList,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    resolvedCandidates: [
      createEntityCandidate({
        id: 18,
        status: "accepted",
        updated_at: "2026-05-02T12:00:00Z",
      }),
      createEntityCandidate({
        id: 19,
        name: "Operator Loop",
        status: "rejected",
        source_plugins: ["rss"],
        source_plugin_count: 1,
        identity_surfaces: [],
      }),
    ],
  },
} satisfies Meta<typeof ResolvedCandidateList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    resolvedCandidates: [],
  },
}
