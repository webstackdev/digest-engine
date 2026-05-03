import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  createThemeSuggestion,
  createTopicCluster,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"

import { ThemeSuggestionCard } from "."

describe("ThemeSuggestionCard", () => {
  it("renders pending theme actions and supporting content", () => {
    const { container } = render(
      <ThemeSuggestionCard
        cluster={createTopicCluster()}
        clusterDetail={createTopicClusterDetail()}
        currentPageHref="/themes?project=1"
        projectId={1}
        theme={createThemeSuggestion()}
      />,
    )

    expect(screen.getByText("Track the platform agent shift")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Useful AI briefing" })).toBeInTheDocument()
    expect(container.querySelector('input[name="reason"]')).toHaveValue("off-topic")
  })

  it("renders dismissal metadata for dismissed themes", () => {
    render(
      <ThemeSuggestionCard
        currentPageHref="/themes?project=1"
        projectId={1}
        theme={createThemeSuggestion({
          status: "dismissed",
          dismissal_reason: "already covered",
          decided_at: "2026-04-29T08:00:00Z",
          decided_by: 4,
          decided_by_username: "editor-1",
        })}
      />,
    )

    expect(screen.getByText("Dismissal reason: already covered")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument()
  })
})