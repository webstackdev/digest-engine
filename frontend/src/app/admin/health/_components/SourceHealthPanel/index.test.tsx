import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { IngestionRun, SourceConfig } from "@/lib/types"

import { SourceHealthPanel } from "."

function createSourceConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    id: 7,
    project: 1,
    plugin_name: "rss",
    config: { feed_url: "https://example.com/feed.xml" },
    is_active: true,
    last_fetched_at: "2026-04-28T08:00:00Z",
    ...overrides,
  }
}

function createIngestionRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
  return {
    id: 22,
    project: 1,
    plugin_name: "rss",
    started_at: "2026-04-28T09:00:00Z",
    completed_at: "2026-04-28T09:03:00Z",
    status: "success",
    items_fetched: 12,
    items_ingested: 9,
    error_message: "",
    ...overrides,
  }
}

describe("SourceHealthPanel", () => {
  it("renders source health rows", () => {
    render(
      <SourceHealthPanel
        rows={[
          {
            sourceConfig: createSourceConfig(),
            latestRun: createIngestionRun(),
            status: "healthy",
          },
        ]}
        statusLabel="sources"
        statusTone="neutral"
      />,
    )

    expect(screen.getByText("Source configuration health")).toBeInTheDocument()
    expect(screen.getByText("rss", { selector: "strong" })).toBeInTheDocument()
    expect(screen.getByText("9/12")).toBeInTheDocument()
  })

  it("renders the empty state when no source configs exist", () => {
    render(<SourceHealthPanel rows={[]} statusLabel="idle" statusTone="neutral" />)

    expect(
      screen.getByText("No source configurations exist for this project yet."),
    ).toBeInTheDocument()
  })
})