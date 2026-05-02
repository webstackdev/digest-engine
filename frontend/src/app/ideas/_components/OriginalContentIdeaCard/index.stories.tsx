import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createOriginalContentIdea } from "@/lib/storybook-fixtures"

import { OriginalContentIdeaCard } from "."

const meta = {
  title: "Pages/Ideas/Components/OriginalContentIdeaCard",
  component: OriginalContentIdeaCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    idea: createOriginalContentIdea(),
    projectId: 1,
    currentPageHref: "/ideas?project=1",
  },
} satisfies Meta<typeof OriginalContentIdeaCard>

export default meta

type Story = StoryObj<typeof meta>

export const Pending: Story = {}

export const Accepted: Story = {
  args: {
    idea: createOriginalContentIdea({
      status: "accepted",
      decided_at: "2026-04-29T09:00:00Z",
      decided_by: 5,
      decided_by_username: "editor-2",
    }),
  },
}

export const Written: Story = {
  args: {
    idea: createOriginalContentIdea({
      status: "written",
      decided_at: "2026-04-30T10:00:00Z",
      decided_by: 5,
      decided_by_username: "editor-2",
    }),
  },
}

export const DismissedWithoutSupportingContent: Story = {
  args: {
    idea: createOriginalContentIdea({
      status: "dismissed",
      dismissal_reason: "needs stronger evidence",
      supporting_contents: [],
    }),
  },
}