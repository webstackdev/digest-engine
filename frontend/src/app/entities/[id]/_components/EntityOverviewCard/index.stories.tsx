import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createEntity } from "@/lib/storybook-fixtures"

import { EntityOverviewCard } from "."

const meta = {
  title: "Pages/EntityDetail/Components/EntityOverviewCard",
  component: EntityOverviewCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    entity: createEntity({
      name: "Anthropic",
      type: "organization",
      authority_score: 0.91,
      description: "Safety-focused AI company",
      website_url: "https://anthropic.com",
      twitter_handle: "anthropicai",
      mention_count: 2,
    }),
  },
} satisfies Meta<typeof EntityOverviewCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const EmptyIdentity: Story = {
  args: {
    entity: createEntity({
      description: "",
      website_url: "",
      github_url: "",
      linkedin_url: "",
      bluesky_handle: "",
      mastodon_handle: "",
      twitter_handle: "",
    }),
  },
}