import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TrendsFilterToolbar } from "."

describe("TrendsFilterToolbar", () => {
  it("renders the filter form and reset link", () => {
    const { container } = render(
      <TrendsFilterToolbar
        availableSources={["rss", "reddit"]}
        daysFilter={30}
        projectId={1}
        sourceFilter="rss"
      />,
    )

    expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute(
      "href",
      "/trends?project=1",
    )
    expect(container.querySelector('input[name="project"]')).toHaveValue("1")
    expect(container.querySelector('input[name="source"]')).toHaveValue("rss")
    expect(container.querySelector('input[name="days"]')).toHaveValue("30")
  })
})
