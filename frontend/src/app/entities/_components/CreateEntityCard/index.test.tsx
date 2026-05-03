import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CreateEntityCard } from "."

describe("CreateEntityCard", () => {
  it("renders the create form with the expected fields", () => {
    render(<CreateEntityCard projectId={3} />)

    expect(screen.getByText("Add a tracked person or organization")).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toBeRequired()
    expect(screen.getByLabelText("Description")).toBeInTheDocument()
    expect(screen.getByLabelText("Website URL")).toBeInTheDocument()
    expect(screen.getByLabelText("Twitter handle")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create entity" })).toBeInTheDocument()
  })

  it("posts to the entities api with the project redirect hint", () => {
    render(<CreateEntityCard projectId={3} />)

    const form = screen.getByRole("button", { name: "Create entity" }).closest("form")
    const projectInput = screen.getByDisplayValue("3")
    const redirectInput = screen.getByDisplayValue("/entities?project=3")

    expect(form).toHaveAttribute("action", "/api/entities")
    expect(form).toHaveAttribute("method", "POST")
    expect(projectInput).toHaveAttribute("name", "projectId")
    expect(projectInput).toHaveAttribute("type", "hidden")
    expect(redirectInput).toHaveAttribute("name", "redirectTo")
    expect(redirectInput).toHaveAttribute("type", "hidden")
  })
})