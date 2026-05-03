import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createEntity } from "@/lib/storybook-fixtures"

import { EntitySidebar } from "."

describe("EntitySidebar", () => {
  it("renders navigation and sibling entities", () => {
    render(
      <EntitySidebar
        selectedProjectId={3}
        siblingEntities={[
          createEntity({ id: 12, name: "OpenAI", project: 3, mention_count: 1 }),
        ]}
      />
    )

    expect(screen.getByRole("link", { name: "Back to entities" })).toHaveAttribute(
      "href",
      "/entities?project=3"
    )
    expect(screen.getByRole("link", { name: "OpenAI" })).toHaveAttribute(
      "href",
      "/entities/12?project=3"
    )
    expect(screen.getByText("1 mention")).toBeInTheDocument()
  })

  it("renders the empty sibling state", () => {
    render(<EntitySidebar selectedProjectId={1} siblingEntities={[]} />)

    expect(screen.getByText("No other entities exist in this project yet.")).toBeInTheDocument()
  })
})