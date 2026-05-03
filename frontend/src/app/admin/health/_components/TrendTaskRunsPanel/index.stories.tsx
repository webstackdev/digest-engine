import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import type {
  TrendTaskRun,
  TrendTaskRunObservabilitySummary,
} from "@/lib/types"

import { TrendTaskRunsPanel } from "."

function createTrendTaskRun(overrides: Partial<TrendTaskRun> = {}): TrendTaskRun {
  return {
    id: 41,
    project: 1,
    task_name: "recompute_topic_centroid",
    task_run_id: "95ae5b14-5d7d-498e-9adc-1dbaab4dd4b8",
    status: "completed",
    started_at: "2026-04-28T08:00:00Z",
    finished_at: "2026-04-28T08:00:01Z",
    latency_ms: 523,
    error_message: "",
    summary: {
      project_id: 1,
      feedback_count: 12,
      upvote_count: 10,
      downvote_count: 2,
    },
    ...overrides,
  }
}

function createSummary(
  overrides: Partial<TrendTaskRunObservabilitySummary> = {},
): TrendTaskRunObservabilitySummary {
  return {
    project: 1,
    run_count: 8,
    failed_run_count: 0,
    latest_runs: [createTrendTaskRun()],
    ...overrides,
  }
}

const historyRuns = [
  createTrendTaskRun(),
  createTrendTaskRun({
    id: 42,
    task_name: "generate_theme_suggestions",
    status: "failed",
    latency_ms: 1480,
    error_message: "OpenRouter timeout",
    summary: { project_id: 1, created: 0, updated: 0, skipped: 2 },
  }),
]

const meta = {
  title: "Pages/AdminHealth/Components/TrendTaskRunsPanel",
  component: TrendTaskRunsPanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    historyHref: "/admin/health?project=1#trend-task-run-history",
    statusLabel: "healthy",
    statusTone: "positive",
    summary: createSummary({ latest_runs: historyRuns, failed_run_count: 1 }),
    visibleRuns: historyRuns,
  },
} satisfies Meta<typeof TrendTaskRunsPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Healthy: Story = {}

export const Failing: Story = {
  args: {
    statusLabel: "failing",
    statusTone: "negative",
  },
}

export const Empty: Story = {
  args: {
    statusLabel: "idle",
    statusTone: "neutral",
    summary: createSummary({ run_count: 0, failed_run_count: 0, latest_runs: [] }),
    visibleRuns: [],
  },
}
