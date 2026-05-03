import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { IngestionRun, SourceConfig } from "@/lib/types"

import { SourceConfigList } from "."

function createSourceConfig(
  overrides: Partial<SourceConfig> = {},
): SourceConfig {
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

function createIngestionRun(
  overrides: Partial<IngestionRun> = {},
): IngestionRun {
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

describe("SourceConfigList", () => {
  it("renders source cards with latest run summaries", () => {
    render(
      <SourceConfigList
        rows={[
          {
            sourceConfig: createSourceConfig(),
            latestRun: createIngestionRun(),
          },
          {
            sourceConfig: createSourceConfig({ id: 8, plugin_name: "reddit", is_active: false }),
            latestRun: createIngestionRun({ id: 23, plugin_name: "reddit", status: "failed", error_message: "Rate limited" }),
          },
        ]}
        selectedProjectId={1}
      />,
    )

    expect(screen.getByRole("heading", { name: "rss" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "reddit" })).toBeInTheDocument()
    expect(screen.getByText("Latest run: success")).toBeInTheDocument()
    expect(screen.getByText("Latest run: failed")).toBeInTheDocument()
    expect(screen.getByText("Rate limited")).toBeInTheDocument()
  })

  it("renders the empty state when no sources exist", () => {
    render(<SourceConfigList rows={[]} selectedProjectId={1} />)

    expect(
      screen.getByText("No source configurations exist for this project yet."),
    ).toBeInTheDocument()
  })
})
