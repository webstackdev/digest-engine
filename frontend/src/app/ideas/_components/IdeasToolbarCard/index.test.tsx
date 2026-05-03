import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { IdeasToolbarCard } from "."

describe("IdeasToolbarCard", () => {
  it("renders the filter controls and generate action", () => {
    const { container } = render(
      <IdeasToolbarCard
        currentPageHref="/ideas?project=7&status=accepted"
        projectId={7}
        statusFilter="accepted"
      />,
    )

    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apply filter" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute(
      "href",
      "/ideas?project=7",
    )
    expect(screen.getByRole("button", { name: "Generate now" })).toBeInTheDocument()
    expect(container.querySelector('input[name="project"]')).toHaveValue("7")
    expect(container.querySelector('input[name="status"]')).toHaveValue("accepted")
    expect(container.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/ideas?project=7&status=accepted",
    )
  })
})