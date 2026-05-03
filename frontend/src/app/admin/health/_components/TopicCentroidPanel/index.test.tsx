import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type {
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
} from "@/lib/types"

import { TopicCentroidPanel } from "."

function createSnapshot(
  overrides: Partial<TopicCentroidSnapshot> = {},
): TopicCentroidSnapshot {
  return {
    id: 3,
    project: 1,
    computed_at: "2026-04-28T08:00:00Z",
    centroid_active: true,
    feedback_count: 14,
    upvote_count: 11,
    downvote_count: 3,
    drift_from_previous: 0.1,
    drift_from_week_ago: 0.2,
    ...overrides,
  }
}

function createSummary(
  overrides: Partial<TopicCentroidObservabilitySummary> = {},
): TopicCentroidObservabilitySummary {
  return {
    project: 1,
    snapshot_count: 3,
    active_snapshot_count: 2,
    avg_drift_from_previous: 0.1,
    avg_drift_from_week_ago: 0.2,
    latest_snapshot: createSnapshot(),
    ...overrides,
  }
}

describe("TopicCentroidPanel", () => {
  it("renders centroid summary metrics and history", () => {
    render(
      <TopicCentroidPanel
        historyHref="/admin/health?project=1#centroid-snapshot-history"
        statusLabel="active"
        statusTone="positive"
        summary={createSummary()}
        trendPoints="0,64 220,50"
        visibleSnapshots={[
          createSnapshot({ id: 1, computed_at: "2026-04-26T08:00:00Z" }),
          createSnapshot({ id: 2, computed_at: "2026-04-27T08:00:00Z", drift_from_previous: 0.2 }),
          createSnapshot(),
        ]}
      />,
    )

    expect(screen.getByText("Topic centroid observability")).toBeInTheDocument()
    expect(screen.getAllByText("10.0%").length).toBeGreaterThan(0)
    expect(screen.getByText("Feedback 14")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Open centroid snapshot history" }),
    ).toHaveAttribute(
      "href",
      "/admin/health?project=1#centroid-snapshot-history",
    )
    expect(screen.getByText("Centroid snapshot history")).toBeInTheDocument()
  })

  it("renders empty states when no snapshots exist", () => {
    render(
      <TopicCentroidPanel
        historyHref="/admin/health?project=1#centroid-snapshot-history"
        statusLabel="idle"
        statusTone="neutral"
        summary={createSummary({
          snapshot_count: 0,
          active_snapshot_count: 0,
          avg_drift_from_previous: null,
          avg_drift_from_week_ago: null,
          latest_snapshot: null,
        })}
        trendPoints="0,36 220,36"
        visibleSnapshots={[]}
      />,
    )

    expect(
      screen.getByText("No centroid snapshots exist for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No centroid snapshot history exists for this project yet."),
    ).toBeInTheDocument()
  })
})
