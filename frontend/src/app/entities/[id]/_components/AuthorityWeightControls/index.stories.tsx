import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createProjectConfig } from "@/lib/storybook-fixtures"

import { AuthorityWeightControls } from "."

const meta = {
  title: "Pages/EntityDetail/Components/AuthorityWeightControls",
  component: AuthorityWeightControls,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    projectConfig: createProjectConfig(),
    projectId: 1,
    redirectTo: "/entities/7?project=1",
  },
} satisfies Meta<typeof AuthorityWeightControls>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoSavedConfig: Story = {
  args: {
    projectConfig: null,
  },
}