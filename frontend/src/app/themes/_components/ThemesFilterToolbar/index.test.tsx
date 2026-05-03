import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ThemesFilterToolbar } from "."

describe("ThemesFilterToolbar", () => {
  it("renders the filter form and reset link", () => {
    const { container } = render(
      <ThemesFilterToolbar projectId={1} statusFilter="pending" />,
    )

    expect(screen.getByRole("button", { name: "Apply filter" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute(
      "href",
      "/themes?project=1",
    )
    expect(container.querySelector('input[name="project"]')).toHaveValue("1")
    expect(container.querySelector('input[name="status"]')).toHaveValue("pending")
  })
})
