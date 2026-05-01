import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { createTopicClusterDetail } from "@/lib/storybook-fixtures"

import { TopicClusterCard } from "./TopicClusterCard"

const meta = {
  title: "Routes/Trends/TopicClusterCard",
  component: TopicClusterCard,
  tags: ["autodocs"],
  args: {
    cluster: createTopicClusterDetail(),
    href: "/trends?project=1&cluster=5",
  },
} satisfies Meta<typeof TopicClusterCard>

export default meta

type Story = StoryObj<typeof meta>

export const HighVelocity: Story = {}

export const Selected: Story = {
  args: {
    isSelected: true,
  },
}

export const LowerVelocityWithoutEntity: Story = {
  args: {
    cluster: createTopicClusterDetail({
      dominant_entity: null,
      label: "Community Signals",
      velocity_score: 0.44,
      z_score: 0.82,
      member_count: 2,
    }),
  },
}