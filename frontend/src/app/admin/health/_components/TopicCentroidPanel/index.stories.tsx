import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createTopicCentroidSnapshot,
  createTopicCentroidSummary,
} from "@/lib/storybook-fixtures"

import { TopicCentroidPanel } from "."

const activeSnapshots = [
  createTopicCentroidSnapshot({ id: 1, computed_at: "2026-04-25T08:00:00Z", drift_from_previous: 0.08 }),
  createTopicCentroidSnapshot({ id: 2, computed_at: "2026-04-26T08:00:00Z", drift_from_previous: 0.11 }),
  createTopicCentroidSnapshot({ id: 3, computed_at: "2026-04-27T08:00:00Z", drift_from_previous: 0.14 }),
]

const meta = {
  title: "Pages/AdminHealth/Components/TopicCentroidPanel",
  component: TopicCentroidPanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    summary: createTopicCentroidSummary({
      snapshot_count: 3,
      active_snapshot_count: 3,
      avg_drift_from_previous: 0.11,
      avg_drift_from_week_ago: 0.18,
      latest_snapshot: activeSnapshots[2],
    }),
    visibleSnapshots: activeSnapshots,
    trendPoints: "0,66 110,58 220,49",
    statusTone: "positive",
    statusLabel: "active",
    historyHref: "/admin/health?project=1#centroid-snapshot-history",
  },
} satisfies Meta<typeof TopicCentroidPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Active: Story = {}

export const NoSnapshots: Story = {
  args: {
    summary: createTopicCentroidSummary({
      snapshot_count: 0,
      active_snapshot_count: 0,
      avg_drift_from_previous: null,
      avg_drift_from_week_ago: null,
      latest_snapshot: null,
    }),
    visibleSnapshots: [],
    trendPoints: "0,36 220,36",
    statusTone: "neutral",
    statusLabel: "idle",
  },
}