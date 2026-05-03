import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"

import { NewProjectFormCard } from "."

const meta = {
  title: "Pages/AdminProjects/New/Components/NewProjectFormCard",
  component: NewProjectFormCard,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
} satisfies Meta<typeof NewProjectFormCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}