import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  createSourceDiversitySnapshot,
  createSourceDiversitySummary,
} from "@/lib/storybook-fixtures"

import { SourceDiversityPanel } from "./SourceDiversityPanel"

const healthySummary = createSourceDiversitySummary()
const healthySnapshots = [
  createSourceDiversitySnapshot({ id: 1, computed_at: "2026-04-25T08:00:00Z", top_plugin_share: 0.49 }),
  createSourceDiversitySnapshot({ id: 2, computed_at: "2026-04-26T08:00:00Z", top_plugin_share: 0.55 }),
  createSourceDiversitySnapshot({ id: 3, computed_at: "2026-04-27T08:00:00Z", top_plugin_share: 0.62 }),
]

const meta = {
  title: "Pages/AdminHealth/SourceDiversityPanel",
  component: SourceDiversityPanel,
  tags: ["autodocs"],
  args: {
    summary: healthySummary,
    visibleSnapshots: healthySnapshots,
    trendPoints: "0,36 110,28 220,18",
    statusTone: "positive",
    statusLabel: "tracked",
  },
} satisfies Meta<typeof SourceDiversityPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Healthy: Story = {}

export const Alerting: Story = {
  args: {
    summary: createSourceDiversitySummary({
      latest_snapshot: createSourceDiversitySnapshot({
        breakdown: {
          ...healthySummary.latest_snapshot!.breakdown,
          alerts: [
            {
              code: "top_plugin_share",
              severity: "warning",
              message: "Your stream is 70%+ from RSS this week.",
            },
          ],
        },
        top_plugin_share: 0.78,
      }),
    }),
    statusTone: "warning",
  },
}

export const NoData: Story = {
  args: {
    summary: createSourceDiversitySummary({
      snapshot_count: 0,
      latest_snapshot: null,
    }),
    visibleSnapshots: [],
    trendPoints: "0,36 220,36",
    statusTone: "neutral",
    statusLabel: "idle",
  },
}
