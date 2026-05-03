import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DraftsToolbar } from "."

describe("DraftsToolbar", () => {
  it("renders filter controls and generate action targets", () => {
    const { container } = render(
      <DraftsToolbar
        currentPageHref="/drafts?project=1&status=ready"
        selectedProjectId={1}
        statusFilter="ready"
      />,
    )

    expect(container.querySelector('input[name="status"]')).toHaveValue("ready")
    expect(screen.getByRole("button", { name: "Apply filter" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute(
      "href",
      "/drafts?project=1",
    )
    expect(container.querySelector('form[action="/api/projects/1/drafts/generate"]')).not.toBeNull()
    expect(screen.getByRole("button", { name: "Generate now" })).toBeInTheDocument()
  })
})
