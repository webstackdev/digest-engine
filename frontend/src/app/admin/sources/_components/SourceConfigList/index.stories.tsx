import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import { createIngestionRun, createSourceConfig } from "@/lib/storybook-fixtures"

import { SourceConfigList } from "."

const meta = {
  title: "Pages/AdminSources/Components/SourceConfigList",
  component: SourceConfigList,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    rows: [
      {
        sourceConfig: createSourceConfig(),
        latestRun: createIngestionRun(),
      },
      {
        sourceConfig: createSourceConfig({
          id: 8,
          plugin_name: "reddit",
          is_active: false,
        }),
        latestRun: createIngestionRun({
          id: 23,
          plugin_name: "reddit",
          status: "failed",
          error_message: "Rate limited",
        }),
      },
    ],
    selectedProjectId: 1,
  },
} satisfies Meta<typeof SourceConfigList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    rows: [],
  },
}
