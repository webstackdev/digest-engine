import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type {
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
} from "@/lib/types"

import { SourceDiversityPanel } from "."

function createSnapshot(
  overrides: Partial<SourceDiversitySnapshot> = {},
): SourceDiversitySnapshot {
  return {
    id: 3,
    project: 1,
    computed_at: "2026-04-28T08:00:00Z",
    window_days: 14,
    plugin_entropy: 0.65,
    source_entropy: 0.72,
    author_entropy: 0.48,
    cluster_entropy: 0.58,
    top_plugin_share: 0.62,
    top_source_share: 0.44,
    breakdown: {
      total_content_count: 12,
      plugin_counts: [{ key: "rss", label: "rss", count: 7, share: 0.58 }],
      source_counts: [
        { key: "feed:1", label: "Example Feed", count: 5, share: 0.42 },
      ],
      author_counts: [],
      cluster_counts: [],
      alerts: [],
    },
    ...overrides,
  }
}

function createSummary(
  overrides: Partial<SourceDiversityObservabilitySummary> = {},
): SourceDiversityObservabilitySummary {
  return {
    project: 1,
    snapshot_count: 2,
    latest_snapshot: createSnapshot(),
    ...overrides,
  }
}

describe("SourceDiversityPanel", () => {
  it("renders source diversity alerts and trend details", () => {
    render(
      <SourceDiversityPanel
        statusLabel="tracked"
        statusTone="warning"
        summary={createSummary({
          latest_snapshot: createSnapshot({
            top_plugin_share: 0.74,
            breakdown: {
              ...createSnapshot().breakdown,
              alerts: [
                {
                  code: "top_plugin_share",
                  severity: "warning",
                  message: "Your stream is 70%+ from RSS this week.",
                },
              ],
            },
          }),
        })}
        trendPoints="0,36 110,28 220,18"
        visibleSnapshots={[createSnapshot({ id: 1 }), createSnapshot({ id: 2, top_plugin_share: 0.74 })]}
      />,
    )

    expect(
      screen.getByRole("heading", { level: 2, name: "Source diversity" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Top plugin share trend").parentElement).toHaveClass(
      "text-content-offset",
    )
    expect(screen.getByText("Your stream is 70%+ from RSS this week.")).toBeInTheDocument()
    expect(screen.getByLabelText("Source diversity trend")).toBeInTheDocument()
  })

  it("renders the empty state when no snapshots exist", () => {
    render(
      <SourceDiversityPanel
        statusLabel="idle"
        statusTone="neutral"
        summary={createSummary({ snapshot_count: 0, latest_snapshot: null })}
        trendPoints="0,36 220,36"
        visibleSnapshots={[]}
      />,
    )

    expect(
      screen.getByText("No source-diversity snapshots exist for this project yet."),
    ).toHaveClass("text-content-offset")
  })
})
