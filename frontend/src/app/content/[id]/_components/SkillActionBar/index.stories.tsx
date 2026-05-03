import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { SkillActionBar } from "@/app/content/[id]/_components/SkillActionBar"
import { compactDocsParameters } from "@/lib/storybook-docs"
import { QueryProvider } from "@/providers/QueryProvider"

const meta = {
  title: "Pages/ContentDetail/Components/SkillActionBar",
  component: SkillActionBar,
  tags: ["autodocs"],
  parameters: { docs: compactDocsParameters },
  decorators: [
    (Story) => (
      <QueryProvider>
        <div className="flex flex-wrap gap-3">
          <Story />
        </div>
      </QueryProvider>
    ),
  ],
  args: {
    projectId: 1,
    contentId: 41,
    canSummarize: true,
    initialPendingSkills: [],
  },
} satisfies Meta<typeof SkillActionBar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SummarizationDisabled: Story = {
  args: {
    canSummarize: false,
  },
}