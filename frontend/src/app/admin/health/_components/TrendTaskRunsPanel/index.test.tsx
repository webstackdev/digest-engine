import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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
    task_run_id: "run-41",
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
    run_count: 2,
    failed_run_count: 1,
    latest_runs: [createTrendTaskRun()],
    ...overrides,
  }
}

describe("TrendTaskRunsPanel", () => {
  it("renders trend task summaries and failure details", () => {
    const failedRun = createTrendTaskRun({
      id: 42,
      task_name: "generate_theme_suggestions",
      status: "failed",
      latency_ms: 1480,
      error_message: "OpenRouter timeout",
      summary: { project_id: 1, created: 0, updated: 0, skipped: 2 },
    })

    render(
      <TrendTaskRunsPanel
        historyHref="/admin/health?project=1#trend-task-run-history"
        statusLabel="failing"
        statusTone="negative"
        summary={createSummary({ latest_runs: [createTrendTaskRun(), failedRun] })}
        visibleRuns={[createTrendTaskRun(), failedRun]}
      />,
    )

    expect(screen.getByText("Trend pipeline runs")).toBeInTheDocument()
    expect(screen.getAllByText("Theme suggestions").length).toBeGreaterThan(0)
    expect(screen.getAllByText("OpenRouter timeout").length).toBeGreaterThan(0)
    expect(screen.getAllByText("1.5s").length).toBeGreaterThan(0)
    expect(screen.getByText("Trend task run history")).toBeInTheDocument()
  })

  it("renders empty states when no task runs exist", () => {
    render(
      <TrendTaskRunsPanel
        historyHref="/admin/health?project=1#trend-task-run-history"
        statusLabel="idle"
        statusTone="neutral"
        summary={createSummary({ run_count: 0, failed_run_count: 0, latest_runs: [] })}
        visibleRuns={[]}
      />,
    )

    expect(
      screen.getByText("No trend pipeline runs have been persisted for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No trend task run history exists for this project yet."),
    ).toBeInTheDocument()
  })
})
