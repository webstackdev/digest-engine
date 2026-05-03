import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createEntity } from "@/lib/storybook-fixtures"

import { EntitySidebar } from "."

const meta = {
  title: "Pages/EntityDetail/Components/EntitySidebar",
  component: EntitySidebar,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    selectedProjectId: 1,
    siblingEntities: [
      createEntity({ id: 12, name: "OpenAI", mention_count: 1 }),
      createEntity({ id: 13, name: "Mistral", mention_count: 3, type: "organization" }),
    ],
  },
} satisfies Meta<typeof EntitySidebar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    siblingEntities: [],
  },
}