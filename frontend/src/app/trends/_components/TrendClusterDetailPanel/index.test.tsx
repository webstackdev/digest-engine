import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createContent, createTopicClusterDetail } from "@/lib/storybook-fixtures"

import { TrendClusterDetailPanel } from "."

describe("TrendClusterDetailPanel", () => {
  it("renders an empty state when no cluster is selected", () => {
    render(
      <TrendClusterDetailPanel contentMap={new Map()} projectId={1} selectedCluster={null} />,
    )

    expect(
      screen.getByText("Select a cluster to inspect its member content and velocity history."),
    ).toBeInTheDocument()
  })

  it("renders cluster detail and drill-down links", () => {
    const cluster = createTopicClusterDetail()
    const content = createContent()
    const contentMap = new Map([[content.id, content]])

    render(
      <TrendClusterDetailPanel
        contentMap={contentMap}
        projectId={1}
        selectedCluster={cluster}
      />,
    )

    expect(screen.getByRole("heading", { level: 2, name: cluster.label ?? "" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Velocity history trend" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open detail" })).toHaveAttribute(
      "href",
      `/content/${cluster.memberships[0]?.content.id}?project=1`,
    )
  })
})