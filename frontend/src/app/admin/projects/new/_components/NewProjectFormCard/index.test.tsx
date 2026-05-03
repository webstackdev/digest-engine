import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { NewProjectFormCard } from "."

describe("NewProjectFormCard", () => {
  it("renders the project creation form fields", () => {
    render(<NewProjectFormCard />)

    expect(screen.getByRole("heading", { level: 2, name: "New project" })).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toBeRequired()
    expect(screen.getByLabelText("Topic description")).toBeRequired()
    expect(screen.getByLabelText("Content retention days")).toHaveValue(365)
    expect(screen.getByRole("button", { name: "Create project" })).toBeInTheDocument()
  })

  it("posts back to the projects api with the redirect hint", () => {
    render(<NewProjectFormCard />)

    const form = screen.getByRole("button", { name: "Create project" }).closest("form")
    const redirectInput = screen.getByDisplayValue("/admin/projects/new")

    expect(form).toHaveAttribute("action", "/api/projects")
    expect(form).toHaveAttribute("method", "POST")
    expect(redirectInput).toHaveAttribute("name", "redirectTo")
    expect(redirectInput).toHaveAttribute("type", "hidden")
  })
})
