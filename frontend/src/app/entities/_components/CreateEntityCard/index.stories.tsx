import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { CreateEntityCard } from "."

const meta = {
  title: "Pages/Entities/Components/CreateEntityCard",
  component: CreateEntityCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectId: 1,
  },
} satisfies Meta<typeof CreateEntityCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}