import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createIngestionRun,
  createSourceConfig,
} from "@/lib/storybook-fixtures"

import { SourceHealthPanel } from "."

const meta = {
  title: "Pages/AdminHealth/Components/SourceHealthPanel",
  component: SourceHealthPanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    statusLabel: "mixed",
    statusTone: "warning",
    rows: [
      {
        sourceConfig: createSourceConfig(),
        latestRun: createIngestionRun(),
        status: "healthy",
      },
      {
        sourceConfig: createSourceConfig({
          id: 8,
          plugin_name: "reddit",
          last_fetched_at: null,
        }),
        latestRun: createIngestionRun({
          id: 23,
          plugin_name: "reddit",
          status: "failed",
          error_message: "Rate limit",
        }),
        status: "failing",
      },
    ],
  },
} satisfies Meta<typeof SourceHealthPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Mixed: Story = {}

export const Empty: Story = {
  args: {
    rows: [],
    statusLabel: "idle",
    statusTone: "neutral",
  },
}