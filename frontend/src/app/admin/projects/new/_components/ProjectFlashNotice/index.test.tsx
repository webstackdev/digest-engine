import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProjectFlashNotice } from "."

describe("ProjectFlashNotice", () => {
  it("renders an error flash notice", () => {
    render(
      <ProjectFlashNotice tone="error">
        A project with that name already exists.
      </ProjectFlashNotice>,
    )

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Could not create project")).toBeInTheDocument()
    expect(
      screen.getByText("A project with that name already exists."),
    ).toBeInTheDocument()
  })

  it("renders a success flash notice", () => {
    render(
      <ProjectFlashNotice tone="success">
        Project created. You are now the first project admin.
      </ProjectFlashNotice>,
    )

    expect(screen.getByText("Project updated")).toBeInTheDocument()
    expect(
      screen.getByText("Project created. You are now the first project admin."),
    ).toBeInTheDocument()
  })
})