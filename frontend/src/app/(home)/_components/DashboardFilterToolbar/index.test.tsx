import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DashboardFilterToolbar } from "."

describe("DashboardFilterToolbar", () => {
  it("renders the dashboard filter form", () => {
    const { container } = render(
      <DashboardFilterToolbar
        contentTypeFilter="article"
        contentTypes={["article", "podcast"]}
        daysFilter={30}
        duplicateStateFilter="duplicate_related"
        projectId={1}
        sourceFilter="rss"
        sources={["rss", "reddit"]}
        view="content"
      />,
    )

    expect(screen.getByRole("button", { name: "Apply filters" })).toHaveClass(
      "hover:bg-primary/84",
    )
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/?project=1")
    expect(container.querySelector("#dashboard-view-filter")).toHaveClass(
      "border-border/45",
      "bg-card/95",
      "hover:bg-secondary/88",
    )
    expect(container.querySelector('input[name="project"]')).toHaveValue("1")
    expect(container.querySelector('input[name="contentType"]')).toHaveValue("article")
    expect(container.querySelector('input[name="source"]')).toHaveValue("rss")
    expect(container.querySelector('input[name="days"]')).toHaveValue("30")
  })
})
